import { randomUUID } from 'crypto'
import { parse } from 'csv-parse/sync'
import {
  fetchProductExistenceCatalogs,
  fetchServerIdentification,
  getDefaultTmsBaseUrl,
  salvarListaEstoques,
} from './tmsService.js'
import { parseBrazilianNumber } from '../utils/productFormats.js'
import { TEMPLATE_DELIMITER } from '../schemas/product.schema.js'

export type StockJobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type StockSendMode = 'live' | 'simulate'

export interface StockJobError {
  index: number
  codigo: string
  message: string
}

export interface StockJobSkipped {
  index: number
  codigo: string
  message: string
}

export interface StockJobSnapshot {
  id: string
  status: StockJobStatus
  mode: StockSendMode
  tmsBaseUrl: string
  idFilial: number
  total: number
  processed: number
  successCount: number
  errorCount: number
  skippedCount: number
  percent: number
  errors: StockJobError[]
  errorsTruncated: boolean
  skipped: StockJobSkipped[]
  skippedTruncated: boolean
  startedAt: string | null
  finishedAt: string | null
  message?: string
}

interface StockJobInternal {
  id: string
  status: StockJobStatus
  mode: StockSendMode
  tmsBaseUrl: string
  idFilial: number
  rows: Record<string, string>[]
  processed: number
  successCount: number
  errorCount: number
  skippedCount: number
  errors: StockJobError[]
  skipped: StockJobSkipped[]
  cancelRequested: boolean
  startedAt: number | null
  finishedAt: number | null
  runPromise?: Promise<void>
}

const jobs = new Map<string, StockJobInternal>()
const MAX_STORED_ERRORS = 200
const MAX_STORED_SKIPPED = 200
/** Delphi: `not Produto.IsControlado` → tipoclassesngpc = tcNenhuma */
const NON_CONTROLLED = 'tcNenhuma'

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

/** Estoque/quantidade: vazio ou ≤ 0 → pular; decimal inválido → 'invalid'. */
function parseEstoque(raw: string): number | null | 'invalid' {
  const cleaned = raw.trim()
  if (!cleaned) return null
  const parsed = parseBrazilianNumber(cleaned)
  if (parsed === null || !Number.isFinite(parsed)) return 'invalid'
  if (parsed <= 0) return null
  const asInt = Math.round(parsed)
  if (Math.abs(parsed - asInt) > 0.001) return 'invalid'
  return asInt
}

function snapshot(job: StockJobInternal): StockJobSnapshot {
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

export function getStockJob(jobId: string): StockJobSnapshot | null {
  const job = jobs.get(jobId)
  return job ? snapshot(job) : null
}

export function parseStockCsvText(text: string): Record<string, string>[] {
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

export async function startStockJob(input: {
  rows: Record<string, string>[]
  tmsBaseUrl?: string
  mode?: StockSendMode
}): Promise<StockJobSnapshot> {
  if (!input.rows.length) {
    throw new Error('Nenhuma linha para importar')
  }

  const tmsBaseUrl = (input.tmsBaseUrl || getDefaultTmsBaseUrl()).replace(/\/$/, '')
  const identification = await fetchServerIdentification(tmsBaseUrl)
  const id = randomUUID()
  const job: StockJobInternal = {
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
  job.runPromise = runStockJob(job)
  return snapshot(job)
}

export function cancelStockJob(jobId: string): StockJobSnapshot | null {
  const job = jobs.get(jobId)
  if (!job) return null
  job.cancelRequested = true
  if (job.status === 'queued' || job.status === 'running') {
    job.status = 'cancelled'
    job.finishedAt = Date.now()
  }
  return snapshot(job)
}

async function runStockJob(job: StockJobInternal): Promise<void> {
  job.status = 'running'
  job.startedAt = Date.now()

  try {
    const existence = await fetchProductExistenceCatalogs(job.tmsBaseUrl)

    for (let index = 0; index < job.rows.length; index++) {
      if (job.cancelRequested) {
        job.status = 'cancelled'
        job.finishedAt = Date.now()
        return
      }

      const row = job.rows[index]
      const codigo = cell(row, 'codigo')
      const codigobarras = cell(row, 'codigobarras', 'codigobarra')
      // Layout produto: estoque | layout código de barras (Delphi): quantidade / quantidadeestoque
      const estoqueRaw = cell(
        row,
        'estoque',
        'quantidade',
        'quantidadeestoque',
        'quantidade_estoque'
      )

      // Delphi: só importa se quantidade > 0; CSV completo sem estoque → ignora
      const estoque = parseEstoque(estoqueRaw)
      if (estoque === null) {
        pushSkipped(job, {
          index,
          codigo: codigo || codigobarras,
          message: estoqueRaw.trim()
            ? 'quantidade ≤ 0 — ignorada'
            : 'estoque/quantidade vazio — ignorado',
        })
        job.processed++
        continue
      }

      if (!codigo && !codigobarras) {
        job.errorCount++
        pushError(job, {
          index,
          codigo: '',
          message:
            'Informe codigo (migração) ou codigobarras para localizar o produto',
        })
        job.processed++
        continue
      }

      if (estoque === 'invalid') {
        job.errorCount++
        pushError(job, {
          index,
          codigo: codigo || codigobarras,
          message: `estoque/quantidade inválido (use inteiro > 0): ${estoqueRaw}`,
        })
        job.processed++
        continue
      }

      let produtoId: number | undefined
      if (codigo) {
        produtoId =
          existence.byMigracao.get(codigo) ??
          existence.byMigracao.get(String(Number(codigo)))
      }
      if (produtoId === undefined && codigobarras) {
        produtoId =
          existence.byBarcode.get(codigobarras) ??
          existence.byBarcode.get(codigobarras.replace(/\D/g, ''))
      }

      if (produtoId === undefined) {
        job.errorCount++
        pushError(job, {
          index,
          codigo: codigo || codigobarras,
          message: codigo
            ? `Produto codigo_migracao=${codigo} não encontrado no banco`
            : `Produto com código de barras ${codigobarras} não encontrado no banco`,
        })
        job.processed++
        continue
      }

      // Delphi: Assigned(Produto) and not Produto.IsControlado → INT000 / MovimentarLote
      const tipoclasse =
        existence.tipoclassesngpcById.get(produtoId) ?? NON_CONTROLLED
      if (tipoclasse !== NON_CONTROLLED) {
        pushSkipped(job, {
          index,
          codigo: codigo || codigobarras,
          message: `produto controlado (${tipoclasse}) — use Lotes`,
        })
        job.processed++
        continue
      }

      if (job.mode === 'simulate') {
        job.successCount++
        job.processed++
        continue
      }

      // Delphi → XData: ImportacaoProdutoService/SalvarListaEstoques
      // Layout barras: CodigoBarras + IsCodigoBarra; senão IdProduto (codigo migração).
      const useBarras = Boolean(codigobarras)
      const result = await salvarListaEstoques(
        [
          {
            QuantidadeEstoque: estoque,
            IsCodigoBarra: useBarras,
            IdFilial: job.idFilial,
            ...(useBarras
              ? { CodigoBarras: codigobarras }
              : { IdProduto: produtoId }),
          },
        ],
        job.tmsBaseUrl
      )

      if (!result.ok) {
        job.errorCount++
        pushError(job, {
          index,
          codigo: codigo || codigobarras,
          message: result.message || 'Falha em SalvarListaEstoques',
        })
        job.processed++
        continue
      }

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
      message: error instanceof Error ? error.message : 'Falha interna no job de estoque',
    })
  }
}

function pushError(job: StockJobInternal, error: StockJobError) {
  if (job.errors.length < MAX_STORED_ERRORS) job.errors.push(error)
}

function pushSkipped(job: StockJobInternal, skip: StockJobSkipped) {
  job.skippedCount++
  if (job.skipped.length < MAX_STORED_SKIPPED) job.skipped.push(skip)
}
