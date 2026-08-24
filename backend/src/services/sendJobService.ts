import { randomUUID } from 'crypto'
import {
  fetchServerIdentification,
  fetchTmsDcbCatalog,
  getDefaultTmsBaseUrl,
  insertAuxiliaryEntity,
  insertProductBatch,
  mapCsvRowToProductPayload,
  type TmsAuxiliaryEntity,
} from './tmsService.js'
import { lookupAnvisaDcb, padDcbCode } from './dcbIndexService.js'

export type SendJobStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type SendMode = 'live' | 'simulate'

export interface SendJobError {
  index: number
  codigo: string
  message: string
  batch: number
}

export interface SendJobSnapshot {
  id: string
  status: SendJobStatus
  mode: SendMode
  tmsBaseUrl: string
  idFilial: number
  batchSize: number
  concurrency: number
  total: number
  processed: number
  successCount: number
  errorCount: number
  currentBatch: number
  totalBatches: number
  errors: SendJobError[]
  errorsTruncated: boolean
  startedAt: string | null
  finishedAt: string | null
  elapsedMs: number
  productsPerSecond: number
  percent: number
  remaining: number
  gruposTotal: number
  gruposInserted: number
  gruposFailed: number
  auxTotal: number
  auxInserted: number
  auxFailed: number
  auxSkipped: number
}

export interface AuxiliarySendRow {
  entity: TmsAuxiliaryEntity
  codigo: string
  descricao: string
}

const AUX_LABEL: Record<TmsAuxiliaryEntity, string> = {
  grupo: 'Grupo',
  subgrupo: 'Subgrupo',
  categoria: 'Categoria',
  laboratorio: 'Laboratório',
  grupodepreco: 'Grupo de preço',
  similar: 'Similar',
  dcb: 'DCB',
}

interface SendJobInternal {
  id: string
  status: SendJobStatus
  mode: SendMode
  tmsBaseUrl: string
  idFilial: number
  batchSize: number
  concurrency: number
  rows: Record<string, string>[]
  pendingIndexes: number[]
  failedIndexes: number[]
  successCount: number
  errorCount: number
  processed: number
  currentBatch: number
  totalBatches: number
  errors: SendJobError[]
  startedAt: number | null
  finishedAt: number | null
  pauseRequested: boolean
  cancelRequested: boolean
  runner: Promise<void> | null
  auxiliaries: AuxiliarySendRow[]
  auxInserted: number
  auxFailed: number
  auxSkipped: number
  auxDone: boolean
}

const MAX_STORED_ERRORS = 500
const JOB_TTL_MS = 6 * 60 * 60 * 1000
const jobs = new Map<string, SendJobInternal>()

const DEFAULT_BATCH_SIZE = Number(process.env.SEND_BATCH_SIZE) || 100
const DEFAULT_CONCURRENCY = Number(process.env.SEND_CONCURRENCY) || 2

function cleanupJobs() {
  const now = Date.now()
  for (const [id, job] of jobs) {
    const anchor = job.finishedAt ?? job.startedAt ?? now
    if (now - anchor > JOB_TTL_MS) jobs.delete(id)
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function toSnapshot(job: SendJobInternal): SendJobSnapshot {
  const now = Date.now()
  const started = job.startedAt ?? now
  const ended = job.finishedAt ?? now
  const elapsedMs = Math.max(0, ended - started)
  const productsPerSecond =
    elapsedMs > 0 ? Number(((job.processed * 1000) / elapsedMs).toFixed(1)) : 0

  return {
    id: job.id,
    status: job.status,
    mode: job.mode,
    tmsBaseUrl: job.tmsBaseUrl,
    idFilial: job.idFilial,
    batchSize: job.batchSize,
    concurrency: job.concurrency,
    total: job.rows.length,
    processed: job.processed,
    successCount: job.successCount,
    errorCount: job.errorCount,
    currentBatch: job.currentBatch,
    totalBatches: job.totalBatches,
    errors: job.errors.slice(0, MAX_STORED_ERRORS),
    errorsTruncated: job.errors.length > MAX_STORED_ERRORS,
    startedAt: job.startedAt ? new Date(job.startedAt).toISOString() : null,
    finishedAt: job.finishedAt ? new Date(job.finishedAt).toISOString() : null,
    elapsedMs,
    productsPerSecond,
    percent: job.rows.length === 0 ? 100 : Math.round((job.processed / job.rows.length) * 100),
    remaining: Math.max(0, job.rows.length - job.processed),
    gruposTotal: job.auxiliaries.filter((a) => a.entity === 'grupo').length,
    gruposInserted: job.auxInserted,
    gruposFailed: job.auxFailed,
    auxTotal: job.auxiliaries.length,
    auxInserted: job.auxInserted,
    auxFailed: job.auxFailed,
    auxSkipped: job.auxSkipped,
  }
}

async function insertAuxiliaries(job: SendJobInternal): Promise<void> {
  if (job.mode !== 'live' || job.auxiliaries.length === 0 || job.auxDone) return

  const remaining = job.auxiliaries.slice(job.auxInserted + job.auxFailed + job.auxSkipped)
  const needsDcbCatalog = remaining.some((item) => item.entity === 'dcb')
  const dcbCatalog = needsDcbCatalog ? await fetchTmsDcbCatalog(job.tmsBaseUrl) : null

  for (const item of remaining) {
    if (job.cancelRequested) return
    while (job.pauseRequested && !job.cancelRequested) {
      job.status = 'paused'
      await sleep(200)
    }
    if (job.cancelRequested) return

    if (item.entity === 'dcb' && dcbCatalog) {
      const padded = padDcbCode(item.codigo)
      const existing = dcbCatalog.get(padded) ?? dcbCatalog.get(item.codigo.trim())
      if (existing) {
        job.auxSkipped++
        continue
      }

      const anvisa = lookupAnvisaDcb(padded)
      const toInsert = {
        codigo: padded,
        descricao: anvisa?.descricao || item.descricao,
      }
      const result = await insertAuxiliaryEntity('dcb', toInsert, job.tmsBaseUrl)
      if (result.ok) {
        job.auxInserted++
        dcbCatalog.set(padded, {
          id: '',
          dcb: padded,
          descricao: toInsert.descricao,
        })
        continue
      }
      job.auxFailed++
      if (job.errors.length < MAX_STORED_ERRORS) {
        job.errors.push({
          index: -1,
          codigo: padded,
          message: `DCB ${padded} (${toInsert.descricao}): ${result.message || 'falha no insert'}`,
          batch: 0,
        })
      }
      continue
    }

    const result = await insertAuxiliaryEntity(item.entity, item, job.tmsBaseUrl)
    if (result.ok) {
      job.auxInserted++
      continue
    }

    job.auxFailed++
    if (job.errors.length < MAX_STORED_ERRORS) {
      const label = AUX_LABEL[item.entity]
      job.errors.push({
        index: -1,
        codigo: item.codigo,
        message: `${label} ${item.codigo} (${item.descricao}): ${result.message || 'falha no insert'}`,
        batch: 0,
      })
    }
  }

  if (!job.cancelRequested) job.auxDone = true
}

async function processOneBatch(
  job: SendJobInternal,
  indexes: number[],
  batchNumber: number
): Promise<void> {
  if (indexes.length === 0) return

  const batchRows = indexes.map((i) => job.rows[i])

  if (job.mode === 'simulate') {
    // Simula latência proporcional ao lote (escala para 5k–20k sem demorar horas).
    await sleep(Math.min(80, 8 + indexes.length * 0.4))

    for (let i = 0; i < indexes.length; i++) {
      const index = indexes[i]
      const row = job.rows[index]
      // ~1% de falha simulada para exercitar retry
      if (Math.random() < 0.01) {
        job.errorCount++
        job.failedIndexes.push(index)
        if (job.errors.length < MAX_STORED_ERRORS) {
          job.errors.push({
            index,
            codigo: String(row.codigo ?? ''),
            message: 'Falha simulada (modo teste)',
            batch: batchNumber,
          })
        }
      } else {
        job.successCount++
      }
      job.processed++
    }
    return
  }

  const payloads = batchRows.map((row) => mapCsvRowToProductPayload(row, job.idFilial))

  try {
    const result = await insertProductBatch(payloads, job.tmsBaseUrl)

    if (result.ok) {
      job.successCount += indexes.length
      job.processed += indexes.length
      return
    }

    // API rejeitou o lote inteiro: tenta item a item para isolar falhas.
    for (let i = 0; i < indexes.length; i++) {
      if (job.cancelRequested) break
      while (job.pauseRequested && !job.cancelRequested) {
        job.status = 'paused'
        await sleep(200)
      }
      if (job.cancelRequested) break

      const index = indexes[i]
      const row = job.rows[index]
      const itemResult = await insertProductBatch(
        [mapCsvRowToProductPayload(row, job.idFilial)],
        job.tmsBaseUrl
      )

      if (itemResult.ok) {
        job.successCount++
      } else {
        job.errorCount++
        job.failedIndexes.push(index)
        if (job.errors.length < MAX_STORED_ERRORS) {
          job.errors.push({
            index,
            codigo: String(row.codigo ?? ''),
            message: itemResult.message || 'Falha no insert',
            batch: batchNumber,
          })
        }
      }
      job.processed++
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha de rede no lote'
    for (const index of indexes) {
      job.errorCount++
      job.failedIndexes.push(index)
      if (job.errors.length < MAX_STORED_ERRORS) {
        job.errors.push({
          index,
          codigo: String(job.rows[index]?.codigo ?? ''),
          message,
          batch: batchNumber,
        })
      }
      job.processed++
    }
  }
}

async function runJob(job: SendJobInternal): Promise<void> {
  job.status = 'running'
  job.startedAt ??= Date.now()
  job.finishedAt = null

  try {
    await insertAuxiliaries(job)
    if (job.cancelRequested) {
      job.status = 'cancelled'
      job.finishedAt = Date.now()
      return
    }

    while (job.pendingIndexes.length > 0) {
      if (job.cancelRequested) {
        job.status = 'cancelled'
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
    job.finishedAt = Date.now()
  } catch (error) {
    job.status = 'failed'
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

  const mode = input.mode ?? 'simulate'
  const tmsBaseUrl = input.tmsBaseUrl ?? getDefaultTmsBaseUrl()
  const batchSize = Math.min(500, Math.max(10, input.batchSize ?? DEFAULT_BATCH_SIZE))
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
  job.totalBatches = Math.ceil(uniqueFailed.length / job.batchSize)
  job.currentBatch = 0
  job.pauseRequested = false
  job.cancelRequested = false
  job.finishedAt = null
  job.status = 'queued'
  // Remove erros dos índices que serão reenviados
  const retrySet = new Set(uniqueFailed)
  job.errors = job.errors.filter((e) => !retrySet.has(e.index))

  startRunner(job)
  return toSnapshot(job)
}
