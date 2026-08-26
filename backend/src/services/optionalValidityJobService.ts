import { randomUUID } from 'crypto'
import { parse } from 'csv-parse/sync'
import {
  fetchProductExistenceCatalogs,
  fetchServerIdentification,
  getDefaultTmsBaseUrl,
  insertValidadeSistemaAntigo,
} from './tmsService.js'
import { TEMPLATE_DELIMITER } from '../schemas/product.schema.js'

export type ValidityJobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type ValiditySendMode = 'live' | 'simulate'

export interface ValidityJobError {
  index: number
  codigo: string
  message: string
}

export interface ValidityJobSkipped {
  index: number
  codigo: string
  message: string
}

export interface ValidityJobSnapshot {
  id: string
  status: ValidityJobStatus
  mode: ValiditySendMode
  tmsBaseUrl: string
  idFilial: number
  total: number
  processed: number
  successCount: number
  errorCount: number
  skippedCount: number
  percent: number
  errors: ValidityJobError[]
  errorsTruncated: boolean
  skipped: ValidityJobSkipped[]
  skippedTruncated: boolean
  startedAt: string | null
  finishedAt: string | null
  message?: string
}

interface ValidityJobInternal {
  id: string
  status: ValidityJobStatus
  mode: ValiditySendMode
  tmsBaseUrl: string
  idFilial: number
  rows: Record<string, string>[]
  processed: number
  successCount: number
  errorCount: number
  skippedCount: number
  errors: ValidityJobError[]
  skipped: ValidityJobSkipped[]
  cancelRequested: boolean
  startedAt: number | null
  finishedAt: number | null
  runPromise?: Promise<void>
}

const jobs = new Map<string, ValidityJobInternal>()
const MAX_STORED_ERRORS = 200
const MAX_STORED_SKIPPED = 200
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

function parseQuantidade(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s/g, '')
  if (!cleaned) return null
  const n = Number(cleaned.replace(',', '.'))
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return null
  return n
}

function snapshot(job: ValidityJobInternal): ValidityJobSnapshot {
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

export function getValidityJob(jobId: string): ValidityJobSnapshot | null {
  const job = jobs.get(jobId)
  return job ? snapshot(job) : null
}

export function parseValidityCsvText(text: string): Record<string, string>[] {
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

export async function startValidityJob(input: {
  rows: Record<string, string>[]
  tmsBaseUrl?: string
  mode?: ValiditySendMode
}): Promise<ValidityJobSnapshot> {
  if (!input.rows.length) {
    throw new Error('Nenhuma linha para importar')
  }

  const tmsBaseUrl = (input.tmsBaseUrl || getDefaultTmsBaseUrl()).replace(/\/$/, '')
  const identification = await fetchServerIdentification(tmsBaseUrl)
  const id = randomUUID()
  const job: ValidityJobInternal = {
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
  job.runPromise = runValidityJob(job)
  return snapshot(job)
}

export function cancelValidityJob(jobId: string): ValidityJobSnapshot | null {
  const job = jobs.get(jobId)
  if (!job) return null
  job.cancelRequested = true
  if (job.status === 'queued' || job.status === 'running') {
    job.status = 'cancelled'
    job.finishedAt = Date.now()
  }
  return snapshot(job)
}

async function runValidityJob(job: ValidityJobInternal): Promise<void> {
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
      const validadeRaw = cell(row, 'validade')
      const quantidadeRaw = cell(row, 'quantidade')

      if (!codigo) {
        job.errorCount++
        pushError(job, {
          index,
          codigo: '',
          message: 'codigo (codigo_migracao do produto) obrigatório',
        })
        job.processed++
        continue
      }

      const validadeIso = parseValidityDate(validadeRaw)
      if (!validadeIso) {
        job.errorCount++
        pushError(job, {
          index,
          codigo,
          message: `validade inválida (use dd/mm/yyyy): ${validadeRaw || '(vazio)'}`,
        })
        job.processed++
        continue
      }

      const quantidade = parseQuantidade(quantidadeRaw)
      if (quantidade === null) {
        job.errorCount++
        pushError(job, {
          index,
          codigo,
          message: `quantidade inválida (use inteiro ≥ 0): ${quantidadeRaw || '(vazio)'}`,
        })
        job.processed++
        continue
      }

      const produtoId =
        existence.byMigracao.get(codigo) ??
        existence.byMigracao.get(String(Number(codigo)))

      if (produtoId === undefined) {
        job.errorCount++
        pushError(job, {
          index,
          codigo,
          message: `Produto codigo_migracao=${codigo} não encontrado no banco`,
        })
        job.processed++
        continue
      }

      const tipoclasse = existence.tipoclassesngpcById.get(produtoId) ?? NON_CONTROLLED
      if (tipoclasse !== NON_CONTROLLED) {
        // Espelha o Delphi: controlado → não importa validade
        pushSkipped(job, {
          index,
          codigo,
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

      const result = await insertValidadeSistemaAntigo(
        { idproduto: produtoId, validade: validadeIso, quantidade },
        job.tmsBaseUrl
      )

      if (!result.ok) {
        job.errorCount++
        pushError(job, {
          index,
          codigo,
          message: result.message || 'Falha ao inserir ValidadeSistemaAntigo',
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
      message:
        error instanceof Error ? error.message : 'Falha interna no job de validade',
    })
  }
}

function pushError(job: ValidityJobInternal, error: ValidityJobError) {
  if (job.errors.length < MAX_STORED_ERRORS) job.errors.push(error)
}

function pushSkipped(job: ValidityJobInternal, skip: ValidityJobSkipped) {
  job.skippedCount++
  if (job.skipped.length < MAX_STORED_SKIPPED) job.skipped.push(skip)
}
