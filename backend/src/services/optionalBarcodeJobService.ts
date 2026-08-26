import { randomUUID } from 'crypto'
import { parse } from 'csv-parse/sync'
import {
  fetchCodigoBarraProdutoRows,
  fetchProductExistenceCatalogs,
  fetchServerIdentification,
  getDefaultTmsBaseUrl,
  insertCodigoBarraProduto,
  resolveProdutoIdFromCsv,
  usableMigracaoCodigo,
} from './tmsService.js'
import { parseBrazilianNumber } from '../utils/productFormats.js'
import { TEMPLATE_DELIMITER } from '../schemas/product.schema.js'

export type BarcodeJobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type BarcodeSendMode = 'live' | 'simulate'

export interface BarcodeJobError {
  index: number
  codigo: string
  codigoadicional: string
  message: string
}

export interface BarcodeJobSkipped {
  index: number
  codigo: string
  codigoadicional: string
  message: string
}

export interface BarcodeJobSnapshot {
  id: string
  status: BarcodeJobStatus
  mode: BarcodeSendMode
  tmsBaseUrl: string
  idFilial: number
  total: number
  processed: number
  successCount: number
  errorCount: number
  skippedCount: number
  percent: number
  errors: BarcodeJobError[]
  errorsTruncated: boolean
  skipped: BarcodeJobSkipped[]
  skippedTruncated: boolean
  startedAt: string | null
  finishedAt: string | null
  message?: string
}

interface BarcodeJobInternal {
  id: string
  status: BarcodeJobStatus
  mode: BarcodeSendMode
  tmsBaseUrl: string
  idFilial: number
  rows: Record<string, string>[]
  processed: number
  successCount: number
  errorCount: number
  skippedCount: number
  errors: BarcodeJobError[]
  skipped: BarcodeJobSkipped[]
  cancelRequested: boolean
  startedAt: number | null
  finishedAt: number | null
  runPromise?: Promise<void>
}

const jobs = new Map<string, BarcodeJobInternal>()
const MAX_STORED_ERRORS = 200
const MAX_STORED_SKIPPED = 200

function cell(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const direct = row[key]
    if (direct !== undefined && String(direct).trim()) return String(direct).trim()
    const found = Object.entries(row).find(([k]) => k.toLowerCase() === key.toLowerCase())
    if (found && String(found[1]).trim()) return String(found[1]).trim()
  }
  return ''
}

function snapshot(job: BarcodeJobInternal): BarcodeJobSnapshot {
  const total = job.rows.length
  const percent = total === 0 ? 100 : Math.min(100, Math.round((job.processed / total) * 100))
  return {
    id: job.id,
    status: job.status,
    mode: job.mode,
    tmsBaseUrl: job.tmsBaseUrl,
    idFilial: job.idFilial,
    total,
    processed: job.processed,
    successCount: job.successCount,
    errorCount: job.errorCount,
    skippedCount: job.skippedCount,
    percent,
    errors: job.errors,
    errorsTruncated: job.errors.length >= MAX_STORED_ERRORS,
    skipped: job.skipped,
    skippedTruncated: job.skipped.length >= MAX_STORED_SKIPPED,
    startedAt: job.startedAt ? new Date(job.startedAt).toISOString() : null,
    finishedAt: job.finishedAt ? new Date(job.finishedAt).toISOString() : null,
  }
}

export function getBarcodeJob(jobId: string): BarcodeJobSnapshot | null {
  const job = jobs.get(jobId)
  return job ? snapshot(job) : null
}

export function parseBarcodeCsvText(text: string): Record<string, string>[] {
  const records = parse(text, {
    columns: true,
    delimiter: TEMPLATE_DELIMITER,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as Record<string, string>[]
  return records.map((row) => {
    const normalized: Record<string, string> = {}
    for (const [k, v] of Object.entries(row)) {
      normalized[k.trim().toLowerCase()] = v == null ? '' : String(v)
    }
    return normalized
  })
}

export async function startBarcodeJob(input: {
  rows: Record<string, string>[]
  tmsBaseUrl?: string
  mode?: BarcodeSendMode
}): Promise<BarcodeJobSnapshot> {
  if (!input.rows.length) {
    throw new Error('Nenhuma linha para importar')
  }

  const tmsBaseUrl = (input.tmsBaseUrl || getDefaultTmsBaseUrl()).replace(/\/$/, '')
  const identification = await fetchServerIdentification(tmsBaseUrl)
  const id = randomUUID()
  const job: BarcodeJobInternal = {
    id,
    status: 'queued',
    mode: input.mode ?? 'live',
    tmsBaseUrl,
    idFilial: identification.idFilial,
    rows: input.rows,
    processed: 0,
    successCount: 0,
    errorCount: 0,
    skippedCount: 0,
    errors: [],
    skipped: [],
    cancelRequested: false,
    startedAt: null,
    finishedAt: null,
  }
  jobs.set(id, job)
  job.runPromise = runBarcodeJob(job)
  return snapshot(job)
}

export function cancelBarcodeJob(jobId: string): BarcodeJobSnapshot | null {
  const job = jobs.get(jobId)
  if (!job) return null
  job.cancelRequested = true
  if (job.status === 'queued' || job.status === 'running') {
    job.status = 'cancelled'
    job.finishedAt = Date.now()
  }
  return snapshot(job)
}

async function runBarcodeJob(job: BarcodeJobInternal): Promise<void> {
  job.status = 'running'
  job.startedAt = Date.now()

  try {
    const existence = await fetchProductExistenceCatalogs(job.tmsBaseUrl)
    const existingBarras = new Set<string>()
    for (const row of await fetchCodigoBarraProdutoRows(job.tmsBaseUrl)) {
      existingBarras.add(row.codigoBarra)
    }
    // Inclui EAN principal dos produtos
    for (const [barcode] of existence.byBarcode) {
      existingBarras.add(barcode)
    }

    for (let index = 0; index < job.rows.length; index++) {
      if (job.cancelRequested) {
        job.status = 'cancelled'
        job.finishedAt = Date.now()
        return
      }

      const row = job.rows[index]
      const codigo = cell(row, 'codigo')
      const codigobarras = cell(row, 'codigobarras', 'codigobarra')
      const codigoadicional = cell(row, 'codigoadicional')
      const fatorRaw = cell(row, 'fator')
      const fatorParsed = fatorRaw ? parseBrazilianNumber(fatorRaw) : 1
      const fator = fatorParsed === null ? NaN : fatorParsed

      // codigo (migração) é opcional — dá para achar o produto só pelo EAN principal.
      if (!codigoadicional) {
        job.errorCount++
        pushError(job, {
          index,
          codigo,
          codigoadicional: '',
          message: 'codigoadicional obrigatório (EAN a cadastrar)',
        })
        job.processed++
        continue
      }

      if (!codigo && !codigobarras) {
        job.errorCount++
        pushError(job, {
          index,
          codigo,
          codigoadicional,
          message:
            'Informe codigobarras (EAN principal) ou codigo (migração) para localizar o produto',
        })
        job.processed++
        continue
      }

      if (!Number.isFinite(fator) || fator <= 0) {
        job.errorCount++
        pushError(job, {
          index,
          codigo,
          codigoadicional,
          message: `fator inválido: ${fatorRaw || '(vazio)'}`,
        })
        job.processed++
        continue
      }

      const migracao = usableMigracaoCodigo(codigo)
      const produtoId = resolveProdutoIdFromCsv(existence, codigo, codigobarras)

      if (produtoId === undefined) {
        job.errorCount++
        pushError(job, {
          index,
          codigo,
          codigoadicional,
          message: migracao
            ? `Produto codigo_migracao=${migracao} não encontrado no banco`
            : `Produto com código de barras ${codigobarras} não encontrado no banco`,
        })
        job.processed++
        continue
      }

      if (existingBarras.has(codigoadicional)) {
        pushSkipped(job, {
          index,
          codigo: migracao || codigobarras || codigo,
          codigoadicional,
          message: `código de barras adicional já cadastrado: ${codigoadicional}`,
        })
        job.processed++
        continue
      }

      if (job.mode === 'simulate') {
        existingBarras.add(codigoadicional)
        job.successCount++
        job.processed++
        continue
      }

      const result = await insertCodigoBarraProduto(
        produtoId,
        { codigoBarra: codigoadicional, fator },
        job.tmsBaseUrl
      )

      if (!result.ok) {
        job.errorCount++
        pushError(job, {
          index,
          codigo,
          codigoadicional,
          message: result.message || 'Falha ao inserir CodigoBarraProduto',
        })
        job.processed++
        continue
      }

      existingBarras.add(codigoadicional)
      job.successCount++
      job.processed++
    }

    job.status = 'completed'
    job.finishedAt = Date.now()
  } catch (error) {
    job.status = 'failed'
    job.finishedAt = Date.now()
    pushError(job, {
      index: -1,
      codigo: '',
      codigoadicional: '',
      message: error instanceof Error ? error.message : 'Falha interna no job de códigos de barras',
    })
  }
}

function pushError(job: BarcodeJobInternal, error: BarcodeJobError) {
  if (job.errors.length < MAX_STORED_ERRORS) job.errors.push(error)
}

function pushSkipped(job: BarcodeJobInternal, skip: BarcodeJobSkipped) {
  job.skippedCount++
  if (job.skipped.length < MAX_STORED_SKIPPED) job.skipped.push(skip)
}
