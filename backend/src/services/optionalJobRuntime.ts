import { randomUUID } from 'crypto'
import { parse } from 'csv-parse/sync'
import { TEMPLATE_DELIMITER } from '../schemas/product.schema.js'
import { parseBrazilianNumber } from '../utils/productFormats.js'
import {
  fetchServerIdentification,
  getDefaultTmsBaseUrl,
} from './tmsService.js'

/** Status compartilhado pelos jobs opcionais (fornecedor / validade / estoque / lotes). */
export type OptionalJobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type OptionalSendMode = 'live' | 'simulate'

export const MAX_STORED_OPTIONAL_ERRORS = 200
export const MAX_STORED_OPTIONAL_SKIPPED = 200

export interface OptionalJobInternal<TError, TSkipped> {
  id: string
  status: OptionalJobStatus
  mode: OptionalSendMode
  tmsBaseUrl: string
  idFilial: number
  rows: Record<string, string>[]
  processed: number
  successCount: number
  errorCount: number
  skippedCount: number
  errors: TError[]
  skipped: TSkipped[]
  cancelRequested: boolean
  startedAt: number | null
  finishedAt: number | null
  runPromise?: Promise<void>
}

export interface OptionalJobSnapshot<TError, TSkipped> {
  id: string
  status: OptionalJobStatus
  mode: OptionalSendMode
  tmsBaseUrl: string
  idFilial: number
  total: number
  processed: number
  successCount: number
  errorCount: number
  skippedCount: number
  percent: number
  errors: TError[]
  errorsTruncated: boolean
  skipped: TSkipped[]
  skippedTruncated: boolean
  startedAt: string | null
  finishedAt: string | null
  message?: string
}

export function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '')
}

export function cell(row: Record<string, string>, ...keys: string[]): string {
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

export function parseOptionalCsvText(text: string): Record<string, string>[] {
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

/** Converte dd/mm/yyyy (ou yyyy-mm-dd) para ISO yyyy-mm-dd. */
export function parseValidityDate(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null

  const br = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (br) {
    const day = Number(br[1])
    const month = Number(br[2])
    const year = Number(br[3])
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    const dt = new Date(year, month - 1, day)
    if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
      return null
    }
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    const year = Number(iso[1])
    const month = Number(iso[2])
    const day = Number(iso[3])
    const dt = new Date(year, month - 1, day)
    if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
      return null
    }
    return `${iso[1]}-${iso[2]}-${iso[3]}`
  }

  return null
}

/**
 * Estoque/quantidade positivo: vazio ou ≤ 0 → null (ignorar);
 * decimal inválido → 'invalid'.
 */
export function parsePositiveEstoque(raw: string): number | null | 'invalid' {
  const cleaned = raw.trim()
  if (!cleaned) return null
  const parsed = parseBrazilianNumber(cleaned)
  if (parsed === null || !Number.isFinite(parsed)) return 'invalid'
  if (parsed <= 0) return null
  const asInt = Math.round(parsed)
  if (Math.abs(parsed - asInt) > 0.001) return 'invalid'
  return asInt
}

function toSnapshot<TError, TSkipped>(
  job: OptionalJobInternal<TError, TSkipped>
): OptionalJobSnapshot<TError, TSkipped> {
  const total = job.rows.length
  const percent =
    total === 0 ? 100 : Math.min(100, Math.round((job.processed / total) * 100))
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
    errorsTruncated: job.errors.length >= MAX_STORED_OPTIONAL_ERRORS,
    skipped: job.skipped,
    skippedTruncated: job.skipped.length >= MAX_STORED_OPTIONAL_SKIPPED,
    startedAt: job.startedAt ? new Date(job.startedAt).toISOString() : null,
    finishedAt: job.finishedAt ? new Date(job.finishedAt).toISOString() : null,
  }
}

/**
 * Store in-memory + start/get/cancel + pushError/pushSkipped.
 * Cada domínio mantém o `run*` próprio; só o esqueleto é compartilhado.
 */
export function createOptionalJobRuntime<TError, TSkipped>() {
  const jobs = new Map<string, OptionalJobInternal<TError, TSkipped>>()

  function getJob(jobId: string): OptionalJobSnapshot<TError, TSkipped> | null {
    const job = jobs.get(jobId)
    return job ? toSnapshot(job) : null
  }

  async function startJob(
    input: {
      rows: Record<string, string>[]
      tmsBaseUrl?: string
      mode?: OptionalSendMode
    },
    run: (job: OptionalJobInternal<TError, TSkipped>) => Promise<void>
  ): Promise<OptionalJobSnapshot<TError, TSkipped>> {
    if (!input.rows.length) {
      throw new Error('Nenhuma linha para importar')
    }

    const tmsBaseUrl = (input.tmsBaseUrl || getDefaultTmsBaseUrl()).replace(/\/$/, '')
    const identification = await fetchServerIdentification(tmsBaseUrl)
    const id = randomUUID()
    const job: OptionalJobInternal<TError, TSkipped> = {
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
    job.runPromise = run(job)
    return toSnapshot(job)
  }

  function cancelJob(jobId: string): OptionalJobSnapshot<TError, TSkipped> | null {
    const job = jobs.get(jobId)
    if (!job) return null
    job.cancelRequested = true
    if (job.status === 'queued' || job.status === 'running') {
      job.status = 'cancelled'
      job.finishedAt = Date.now()
    }
    return toSnapshot(job)
  }

  function pushError(job: OptionalJobInternal<TError, TSkipped>, error: TError) {
    if (job.errors.length < MAX_STORED_OPTIONAL_ERRORS) job.errors.push(error)
  }

  function pushSkipped(job: OptionalJobInternal<TError, TSkipped>, skip: TSkipped) {
    job.skippedCount++
    if (job.skipped.length < MAX_STORED_OPTIONAL_SKIPPED) job.skipped.push(skip)
  }

  return { getJob, startJob, cancelJob, pushError, pushSkipped }
}
