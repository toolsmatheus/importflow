import { randomUUID } from 'crypto'
import { parse } from 'csv-parse/sync'
import {
  favorecidoMigracaoExists,
  fetchFavorecidoMigracaoKeys,
  fetchProductCodigoFornecedorKeys,
  fetchProductExistenceCatalogs,
  fetchServerIdentification,
  getDefaultTmsBaseUrl,
  insertCodigoFornecedor,
  parseFavorecidoMigracao,
  resolveProdutoIdFromCsv,
  usableMigracaoCodigo,
} from './tmsService.js'
import { parseBrazilianNumber } from '../utils/productFormats.js'
import { TEMPLATE_DELIMITER } from '../schemas/product.schema.js'

export type SupplierJobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type SupplierSendMode = 'live' | 'simulate'

export interface SupplierJobError {
  index: number
  codigo: string
  codigofornecedor: string
  message: string
}

export interface SupplierJobSkipped {
  index: number
  codigo: string
  codigofornecedor: string
  message: string
}

export interface SupplierJobSnapshot {
  id: string
  status: SupplierJobStatus
  mode: SupplierSendMode
  tmsBaseUrl: string
  idFilial: number
  total: number
  processed: number
  successCount: number
  errorCount: number
  skippedCount: number
  percent: number
  errors: SupplierJobError[]
  errorsTruncated: boolean
  skipped: SupplierJobSkipped[]
  skippedTruncated: boolean
  startedAt: string | null
  finishedAt: string | null
  message?: string
}

interface SupplierJobInternal {
  id: string
  status: SupplierJobStatus
  mode: SupplierSendMode
  tmsBaseUrl: string
  idFilial: number
  rows: Record<string, string>[]
  processed: number
  successCount: number
  errorCount: number
  skippedCount: number
  errors: SupplierJobError[]
  skipped: SupplierJobSkipped[]
  cancelRequested: boolean
  startedAt: number | null
  finishedAt: number | null
  runPromise?: Promise<void>
}

const jobs = new Map<string, SupplierJobInternal>()
const MAX_STORED_ERRORS = 200
const MAX_STORED_SKIPPED = 200

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '')
}

function cell(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const want = stripAccents(key).toLowerCase()
    const direct = row[key] ?? row[want]
    if (direct !== undefined && String(direct).trim()) return String(direct).trim()
    const found = Object.entries(row).find(
      ([k]) => stripAccents(k).toLowerCase() === want
    )
    if (found && String(found[1]).trim()) return String(found[1]).trim()
  }
  return ''
}

function supplierKey(favorecidoMigracao: number, codigoOriginal: string): string {
  return `${favorecidoMigracao}|${codigoOriginal}`
}

function snapshot(job: SupplierJobInternal): SupplierJobSnapshot {
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

export function getSupplierJob(jobId: string): SupplierJobSnapshot | null {
  const job = jobs.get(jobId)
  return job ? snapshot(job) : null
}

export function parseSupplierCsvText(text: string): Record<string, string>[] {
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
      normalized[stripAccents(k).trim().toLowerCase()] = v == null ? '' : String(v)
    }
    return normalized
  })
}

export async function startSupplierJob(input: {
  rows: Record<string, string>[]
  tmsBaseUrl?: string
  mode?: SupplierSendMode
}): Promise<SupplierJobSnapshot> {
  if (!input.rows.length) {
    throw new Error('Nenhuma linha para importar')
  }

  const tmsBaseUrl = (input.tmsBaseUrl || getDefaultTmsBaseUrl()).replace(/\/$/, '')
  const identification = await fetchServerIdentification(tmsBaseUrl)
  const id = randomUUID()
  const job: SupplierJobInternal = {
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
  job.runPromise = runSupplierJob(job)
  return snapshot(job)
}

export function cancelSupplierJob(jobId: string): SupplierJobSnapshot | null {
  const job = jobs.get(jobId)
  if (!job) return null
  job.cancelRequested = true
  if (job.status === 'queued' || job.status === 'running') {
    job.status = 'cancelled'
    job.finishedAt = Date.now()
  }
  return snapshot(job)
}

function parseFatorCompra(raw: string): number | null {
  if (!raw.trim()) return 1
  const parsed = parseBrazilianNumber(raw)
  if (parsed === null || !Number.isFinite(parsed) || parsed < 0) return null
  const asInt = Math.round(parsed)
  if (Math.abs(parsed - asInt) > 0.001) return null
  return asInt
}

async function runSupplierJob(job: SupplierJobInternal): Promise<void> {
  job.status = 'running'
  job.startedAt = Date.now()

  try {
    const existence = await fetchProductExistenceCatalogs(job.tmsBaseUrl)
    const favorecidoMigracaoKeys = await fetchFavorecidoMigracaoKeys(job.tmsBaseUrl)
    const productSupplierKeys = new Map<number, Set<string>>()

    for (let index = 0; index < job.rows.length; index++) {
      if (job.cancelRequested) {
        job.status = 'cancelled'
        job.finishedAt = Date.now()
        return
      }

      const row = job.rows[index]
      const codigo = cell(row, 'codigo')
      const codigobarras = cell(row, 'codigobarras', 'codigobarra')
      const codigofornecedor = cell(row, 'codigofornecedor')
      const codigooriginal = cell(row, 'codigooriginal')
      const fatorRaw = cell(row, 'fator')
      const fatorCompra = parseFatorCompra(fatorRaw)

      if (!codigooriginal) {
        job.errorCount++
        pushError(job, {
          index,
          codigo,
          codigofornecedor,
          message: 'codigooriginal obrigatório (código do produto no fornecedor)',
        })
        job.processed++
        continue
      }

      if (!codigofornecedor) {
        job.errorCount++
        pushError(job, {
          index,
          codigo,
          codigofornecedor: '',
          message: 'codigofornecedor obrigatório (codigo_migracao do favorecido/fornecedor)',
        })
        job.processed++
        continue
      }

      const favorecidoMigracao = parseFavorecidoMigracao(codigofornecedor)
      if (favorecidoMigracao === null) {
        job.errorCount++
        pushError(job, {
          index,
          codigo,
          codigofornecedor,
          message: `codigofornecedor inválido (use codigo_migracao inteiro do fornecedor): ${codigofornecedor}`,
        })
        job.processed++
        continue
      }

      if (!favorecidoMigracaoExists(favorecidoMigracaoKeys, codigofornecedor)) {
        job.errorCount++
        pushError(job, {
          index,
          codigo,
          codigofornecedor,
          message: `Fornecedor codigo_migracao=${codigofornecedor} não encontrado no banco`,
        })
        job.processed++
        continue
      }

      if (!codigo && !codigobarras) {
        job.errorCount++
        pushError(job, {
          index,
          codigo,
          codigofornecedor,
          message:
            'Informe codigobarras (EAN principal) ou codigo (migração do produto) para localizar o produto',
        })
        job.processed++
        continue
      }

      if (fatorCompra === null) {
        job.errorCount++
        pushError(job, {
          index,
          codigo,
          codigofornecedor,
          message: `fator inválido (use inteiro): ${fatorRaw || '(vazio)'}`,
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
          codigofornecedor,
          message: migracao
            ? `Produto codigo_migracao=${migracao} não encontrado no banco`
            : `Produto com código de barras ${codigobarras} não encontrado no banco`,
        })
        job.processed++
        continue
      }

      if (!productSupplierKeys.has(produtoId)) {
        productSupplierKeys.set(
          produtoId,
          await fetchProductCodigoFornecedorKeys(produtoId, job.tmsBaseUrl)
        )
      }
      const existingForProduct = productSupplierKeys.get(produtoId)!
      const dedupeKey = supplierKey(favorecidoMigracao, codigooriginal)

      if (existingForProduct.has(dedupeKey)) {
        pushSkipped(job, {
          index,
          codigo: migracao || codigobarras || codigo,
          codigofornecedor: String(favorecidoMigracao),
          message: `código de fornecedor já cadastrado (favorecido ${favorecidoMigracao}, original ${codigooriginal})`,
        })
        job.processed++
        continue
      }

      if (job.mode === 'simulate') {
        existingForProduct.add(dedupeKey)
        job.successCount++
        job.processed++
        continue
      }

      const result = await insertCodigoFornecedor(
        produtoId,
        {
          codigo: codigooriginal,
          fatorCompra,
          favorecidoMigracao,
        },
        job.tmsBaseUrl
      )

      if (!result.ok) {
        job.errorCount++
        pushError(job, {
          index,
          codigo,
          codigofornecedor,
          message: result.message || 'Falha ao inserir CodigoFornecedor',
        })
        job.processed++
        continue
      }

      existingForProduct.add(dedupeKey)
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
      codigofornecedor: '',
      message:
        error instanceof Error ? error.message : 'Falha interna no job de códigos de fornecedor',
    })
  }
}

function pushError(job: SupplierJobInternal, error: SupplierJobError) {
  if (job.errors.length < MAX_STORED_ERRORS) job.errors.push(error)
}

function pushSkipped(job: SupplierJobInternal, skip: SupplierJobSkipped) {
  job.skippedCount++
  if (job.skipped.length < MAX_STORED_SKIPPED) job.skipped.push(skip)
}
