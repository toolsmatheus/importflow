import { randomUUID } from 'crypto'
import {
  fetchProductExistenceCatalogs,
  fetchProductLookupCatalogs,
  fetchServerIdentification,
  getDefaultTmsBaseUrl,
} from './tmsService.js'
import { TEMPLATE_DELIMITER } from '../schemas/product.schema.js'
import { insertAuxiliaries } from './send/sendJobAuxiliaries.js'
import { processOneBatch } from './send/sendJobBatch.js'
import { toSnapshot } from './send/sendJobSnapshot.js'
import {
  JOB_TTL_MS,
  MAX_STORED_ERRORS,
  type AuxiliarySendRow,
  type SendJobInternal,
  type SendJobSnapshot,
  type SendMode,
} from './send/sendJobTypes.js'

export type {
  AuxiliarySendRow,
  ProductSkipReason,
  SendJobError,
  SendJobPhase,
  SendJobSkippedProduct,
  SendJobSnapshot,
  SendJobStatus,
  SendMode,
} from './send/sendJobTypes.js'

export { toSnapshot } from './send/sendJobSnapshot.js'

const jobs = new Map<string, SendJobInternal>()

const DEFAULT_BATCH_SIZE = Number(process.env.SEND_BATCH_SIZE) || 500
const DEFAULT_CONCURRENCY = Number(process.env.SEND_CONCURRENCY) || 1

function cleanupJobs() {
  const now = Date.now()
  for (const [id, job] of jobs) {
    const anchor = job.finishedAt ?? job.startedAt ?? now
    if (now - anchor > JOB_TTL_MS) jobs.delete(id)
  }
}

function csvEscape(value: string): string {
  if (/[;"\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

/** CSV dos produtos ignorados (já existiam no TMS). */
export function buildSkippedProductsCsv(jobId: string): string | null {
  const job = jobs.get(jobId)
  if (!job) return null
  if (job.skipped.length === 0) {
    return `motivo;id_tms;codigo;nome;codigobarras\n`
  }

  const baseColumns = Object.keys(job.rows[job.skipped[0].index] ?? {})
  const headers = ['motivo', 'id_tms', 'mensagem', ...baseColumns]
  const lines = [headers.join(TEMPLATE_DELIMITER)]

  for (const skip of job.skipped) {
    const row = job.rows[skip.index] ?? {}
    const values = [
      skip.reason,
      skip.tmsProdutoId === null ? '' : String(skip.tmsProdutoId),
      skip.message,
      ...baseColumns.map((col) => csvEscape(String(row[col] ?? ''))),
    ]
    lines.push(values.join(TEMPLATE_DELIMITER))
  }

  return `${lines.join('\n')}\n`
}

async function runJob(job: SendJobInternal): Promise<void> {
  job.status = 'running'
  job.startedAt ??= Date.now()
  job.finishedAt = null

  try {
    if (job.mode === 'live' && job.auxiliaries.length > 0 && !job.auxDone) {
      job.phase = 'auxiliaries'
    }

    await insertAuxiliaries(job)
    if (job.cancelRequested) {
      job.status = 'cancelled'
      job.phase = 'done'
      job.finishedAt = Date.now()
      return
    }

    if (job.mode === 'live') {
      job.phase = 'catalogs'
      const similarAux = job.auxiliaries
        .filter((a) => a.entity === 'similar')
        .map((a) => ({ codigo: a.codigo, descricao: a.descricao }))
      const dcbAux = job.auxiliaries
        .filter((a) => a.entity === 'dcb')
        .map((a) => ({ codigo: a.codigo, descricao: a.descricao }))
      const [lookup, existence] = await Promise.all([
        fetchProductLookupCatalogs(job.tmsBaseUrl, similarAux, dcbAux),
        fetchProductExistenceCatalogs(job.tmsBaseUrl),
      ])
      job.productCatalogs = lookup
      job.productExistence = existence
    }

    job.phase = 'products'

    while (job.pendingIndexes.length > 0) {
      if (job.cancelRequested) {
        job.status = 'cancelled'
        job.phase = 'done'
        job.finishedAt = Date.now()
        return
      }

      if (job.pauseRequested) {
        job.status = 'paused'
        return
      }

      const batches: number[][] = []
      for (let c = 0; c < job.concurrency && job.pendingIndexes.length > 0; c++) {
        batches.push(job.pendingIndexes.splice(0, job.batchSize))
      }

      await Promise.all(
        batches.map(async (indexes) => {
          job.currentBatch++
          await processOneBatch(job, indexes, job.currentBatch)
        })
      )
    }

    job.status = 'completed'
    job.phase = 'done'
    job.finishedAt = Date.now()
  } catch (error) {
    job.status = 'failed'
    job.phase = 'done'
    job.finishedAt = Date.now()
    if (job.errors.length < MAX_STORED_ERRORS) {
      job.errors.push({
        index: -1,
        codigo: '',
        message: error instanceof Error ? error.message : 'Falha interna no job de envio',
        batch: job.currentBatch,
      })
    }
  }
}

function startRunner(job: SendJobInternal) {
  job.runner = runJob(job).finally(() => {
    job.runner = null
  })
}

export async function createSendJob(input: {
  rows: Record<string, string>[]
  mode?: SendMode
  tmsBaseUrl?: string
  batchSize?: number
  concurrency?: number
  auxiliaries?: AuxiliarySendRow[]
}): Promise<SendJobSnapshot> {
  cleanupJobs()

  const mode = input.mode ?? 'live'
  const tmsBaseUrl = input.tmsBaseUrl ?? getDefaultTmsBaseUrl()
  const batchSize = Math.min(1000, Math.max(10, input.batchSize ?? DEFAULT_BATCH_SIZE))
  const concurrency = Math.min(8, Math.max(1, input.concurrency ?? DEFAULT_CONCURRENCY))
  const auxiliaries = (input.auxiliaries ?? [])
    .map((item) => ({
      entity: item.entity,
      codigo: String(item.codigo ?? '').trim(),
      descricao: String(item.descricao ?? '').trim().toLocaleUpperCase('pt-BR'),
    }))
    .filter((item) => item.codigo && item.descricao)

  let idFilial = 1
  if (mode === 'live') {
    const identification = await fetchServerIdentification(tmsBaseUrl)
    idFilial = identification.idFilial
  }

  const pendingIndexes = input.rows.map((_, i) => i)
  const totalBatches = Math.ceil(pendingIndexes.length / batchSize) || 0

  const job: SendJobInternal = {
    id: randomUUID(),
    status: 'queued',
    mode,
    phase: mode === 'live' && auxiliaries.length > 0 ? 'auxiliaries' : 'products',
    tmsBaseUrl,
    idFilial,
    batchSize,
    concurrency,
    rows: input.rows,
    pendingIndexes,
    failedIndexes: [],
    successCount: 0,
    errorCount: 0,
    processed: 0,
    currentBatch: 0,
    totalBatches,
    errors: [],
    startedAt: null,
    finishedAt: null,
    pauseRequested: false,
    cancelRequested: false,
    runner: null,
    auxiliaries,
    auxInserted: 0,
    auxFailed: 0,
    auxSkipped: 0,
    auxDone: false,
    productCatalogs: null,
    productExistence: null,
    skipped: [],
  }

  jobs.set(job.id, job)
  startRunner(job)
  return toSnapshot(job)
}

export function getSendJob(jobId: string): SendJobSnapshot | null {
  const job = jobs.get(jobId)
  return job ? toSnapshot(job) : null
}

export function pauseSendJob(jobId: string): SendJobSnapshot | null {
  const job = jobs.get(jobId)
  if (!job) return null
  if (job.status === 'running' || job.status === 'queued') {
    job.pauseRequested = true
  }
  return toSnapshot(job)
}

export function resumeSendJob(jobId: string): SendJobSnapshot | null {
  const job = jobs.get(jobId)
  if (!job) return null
  if (job.status !== 'paused' && job.status !== 'queued') return toSnapshot(job)

  job.pauseRequested = false
  job.cancelRequested = false
  if (!job.runner) startRunner(job)
  return toSnapshot(job)
}

export function cancelSendJob(jobId: string): SendJobSnapshot | null {
  const job = jobs.get(jobId)
  if (!job) return null
  job.cancelRequested = true
  job.pauseRequested = false
  if (job.status === 'paused' || job.status === 'queued') {
    job.status = 'cancelled'
    job.finishedAt = Date.now()
  }
  return toSnapshot(job)
}

/** Reenfileira apenas os índices que falharam. */
export function retryFailedSendJob(jobId: string): SendJobSnapshot | null {
  const job = jobs.get(jobId)
  if (!job) return null
  if (job.runner) return toSnapshot(job)

  const uniqueFailed = [...new Set(job.failedIndexes)]
  if (uniqueFailed.length === 0) return toSnapshot(job)

  job.pendingIndexes = uniqueFailed
  job.failedIndexes = []
  job.errorCount = Math.max(0, job.errorCount - uniqueFailed.length)
  job.processed = Math.max(0, job.processed - uniqueFailed.length)
  job.totalBatches = Math.ceil(uniqueFailed.length / job.batchSize) || 0
  job.currentBatch = 0
  job.status = 'queued'
  job.phase = 'products'
  job.pauseRequested = false
  job.cancelRequested = false
  job.finishedAt = null
  startRunner(job)
  return toSnapshot(job)
}
