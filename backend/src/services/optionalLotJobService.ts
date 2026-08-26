import { randomUUID } from 'crypto'
import { parse } from 'csv-parse/sync'
import {
  fetchProductExistenceCatalogs,
  fetchServerIdentification,
  findLoteMedicamento,
  findRegistroMsId,
  getDefaultTmsBaseUrl,
  insertLoteMedicamento,
  resolveProdutoIdFromCsv,
  setLoteMedicamentoQuantidade,
  usableMigracaoCodigo,
} from './tmsService.js'
import { parseValidityDate } from './optionalValidityJobService.js'
import { parseBrazilianNumber } from '../utils/productFormats.js'
import { TEMPLATE_DELIMITER } from '../schemas/product.schema.js'

export type LotJobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type LotSendMode = 'live' | 'simulate'

export interface LotJobError {
  index: number
  codigo: string
  message: string
}

export interface LotJobSkipped {
  index: number
  codigo: string
  message: string
}

export interface LotJobSnapshot {
  id: string
  status: LotJobStatus
  mode: LotSendMode
  tmsBaseUrl: string
  idFilial: number
  total: number
  processed: number
  successCount: number
  errorCount: number
  skippedCount: number
  percent: number
  errors: LotJobError[]
  errorsTruncated: boolean
  skipped: LotJobSkipped[]
  skippedTruncated: boolean
  startedAt: string | null
  finishedAt: string | null
  message?: string
}

interface LotJobInternal {
  id: string
  status: LotJobStatus
  mode: LotSendMode
  tmsBaseUrl: string
  idFilial: number
  rows: Record<string, string>[]
  processed: number
  successCount: number
  errorCount: number
  skippedCount: number
  errors: LotJobError[]
  skipped: LotJobSkipped[]
  cancelRequested: boolean
  startedAt: number | null
  finishedAt: number | null
  runPromise?: Promise<void>
}

const jobs = new Map<string, LotJobInternal>()
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

function snapshot(job: LotJobInternal): LotJobSnapshot {
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

export function getLotJob(jobId: string): LotJobSnapshot | null {
  const job = jobs.get(jobId)
  return job ? snapshot(job) : null
}

export function parseLotCsvText(text: string): Record<string, string>[] {
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

export async function startLotJob(input: {
  rows: Record<string, string>[]
  tmsBaseUrl?: string
  mode?: LotSendMode
}): Promise<LotJobSnapshot> {
  if (!input.rows.length) {
    throw new Error('Nenhuma linha para importar')
  }

  const tmsBaseUrl = (input.tmsBaseUrl || getDefaultTmsBaseUrl()).replace(/\/$/, '')
  const identification = await fetchServerIdentification(tmsBaseUrl)
  const id = randomUUID()
  const job: LotJobInternal = {
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
  job.runPromise = runLotJob(job)
  return snapshot(job)
}

export function cancelLotJob(jobId: string): LotJobSnapshot | null {
  const job = jobs.get(jobId)
  if (!job) return null
  job.cancelRequested = true
  if (job.status === 'queued' || job.status === 'running') {
    job.status = 'cancelled'
    job.finishedAt = Date.now()
  }
  return snapshot(job)
}

async function runLotJob(job: LotJobInternal): Promise<void> {
  job.status = 'running'
  job.startedAt = Date.now()

  try {
    const existence = await fetchProductExistenceCatalogs(job.tmsBaseUrl)
    const registroMsIdCache = new Map<string, number | undefined>()

    for (let index = 0; index < job.rows.length; index++) {
      if (job.cancelRequested) {
        job.status = 'cancelled'
        job.finishedAt = Date.now()
        return
      }

      const row = job.rows[index]
      const codigo = cell(row, 'codigo')
      const codigobarras = cell(row, 'codigobarras', 'codigobarra')
      const lote = cell(row, 'lote', 'numerolote')
      const registroms = cell(row, 'registroms', 'registro_ms')
      const estoqueRaw = cell(row, 'estoque', 'quantidade', 'quantidadeestoque')
      const fabricacaoRaw = cell(row, 'fabricacao', 'datafabricacao')
      const validadeRaw = cell(row, 'validade', 'datavalidade')

      if (!codigo && !codigobarras) {
        job.errorCount++
        pushError(job, {
          index,
          codigo: '',
          message: 'Informe codigo (migração) ou codigobarras',
        })
        job.processed++
        continue
      }

      if (!lote) {
        job.errorCount++
        pushError(job, {
          index,
          codigo: codigo || codigobarras,
          message: 'lote obrigatório',
        })
        job.processed++
        continue
      }

      if (!registroms) {
        job.errorCount++
        pushError(job, {
          index,
          codigo: codigo || codigobarras,
          message: 'registroms obrigatório',
        })
        job.processed++
        continue
      }

      const estoque = parseEstoque(estoqueRaw)
      if (estoque === null) {
        pushSkipped(job, {
          index,
          codigo: codigo || codigobarras,
          message: estoqueRaw.trim()
            ? 'estoque ≤ 0 — ignorado'
            : 'estoque vazio — ignorado',
        })
        job.processed++
        continue
      }
      if (estoque === 'invalid') {
        job.errorCount++
        pushError(job, {
          index,
          codigo: codigo || codigobarras,
          message: `estoque inválido (use inteiro > 0): ${estoqueRaw}`,
        })
        job.processed++
        continue
      }

      const fabricacao = parseValidityDate(fabricacaoRaw)
      if (!fabricacao) {
        job.errorCount++
        pushError(job, {
          index,
          codigo: codigo || codigobarras,
          message: `fabricação inválida (use dd/mm/yyyy): ${fabricacaoRaw || '(vazio)'}`,
        })
        job.processed++
        continue
      }

      const validade = parseValidityDate(validadeRaw)
      if (!validade) {
        job.errorCount++
        pushError(job, {
          index,
          codigo: codigo || codigobarras,
          message: `validade inválida (use dd/mm/yyyy): ${validadeRaw || '(vazio)'}`,
        })
        job.processed++
        continue
      }

      // codigo (≠ 0) primeiro; senão codigobarras — CSV costuma mandar codigo=0 só com EAN
      const migracao = usableMigracaoCodigo(codigo)
      const ref = migracao || codigobarras || codigo
      const produtoId = resolveProdutoIdFromCsv(existence, codigo, codigobarras)

      if (produtoId === undefined) {
        job.errorCount++
        pushError(job, {
          index,
          codigo: ref,
          message: migracao
            ? `Produto codigo_migracao=${migracao} não encontrado no banco`
            : `Produto com código de barras ${codigobarras} não encontrado no banco`,
        })
        job.processed++
        continue
      }

      const tipoclasse =
        existence.tipoclassesngpcById.get(produtoId) ?? NON_CONTROLLED
      if (tipoclasse === NON_CONTROLLED) {
        pushSkipped(job, {
          index,
          codigo: ref,
          message: 'produto não controlado (tcNenhuma) — use Estoque',
        })
        job.processed++
        continue
      }

      if (job.mode === 'simulate') {
        job.successCount++
        job.processed++
        continue
      }

      const existing = await findLoteMedicamento(produtoId, lote, job.tmsBaseUrl)
      if (existing) {
        if (existing.quantidade <= 0 && estoque > 0) {
          const qty = await setLoteMedicamentoQuantidade(
            existing.id,
            estoque,
            job.tmsBaseUrl
          )
          if (!qty.ok) {
            job.errorCount++
            pushError(job, {
              index,
              codigo: ref,
              message:
                `lote ${lote} já existia sem quantidade; falha ao gravar qtd=${estoque}: ` +
                (qty.message || 'erro'),
            })
            job.processed++
            continue
          }
          job.successCount++
          job.processed++
          continue
        }
        pushSkipped(job, {
          index,
          codigo: ref,
          message: `lote ${lote} já cadastrado para o produto (qtd=${existing.quantidade})`,
        })
        job.processed++
        continue
      }

      // Controlados: POST LoteMedicamento (SalvarListaEstoques rejeita / não grava lote nomeado)
      let registroMsId: number | undefined
      if (registroms) {
        if (registroMsIdCache.has(registroms)) {
          registroMsId = registroMsIdCache.get(registroms)
        } else {
          registroMsId = await findRegistroMsId(registroms, job.tmsBaseUrl)
          registroMsIdCache.set(registroms, registroMsId)
        }
      }

      const result = await insertLoteMedicamento(
        {
          produtoId,
          lote,
          quantidade: estoque,
          fabricacao,
          validade,
          idFilial: job.idFilial,
          registroMsId,
          ...(registroMsId === undefined ? { registroMs: registroms } : {}),
        },
        job.tmsBaseUrl
      )

      if (!result.ok) {
        job.errorCount++
        pushError(job, {
          index,
          codigo: ref,
          message: result.message || 'Falha ao inserir LoteMedicamento',
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
      message: error instanceof Error ? error.message : 'Falha interna no job de lotes',
    })
  }
}

function pushError(job: LotJobInternal, error: LotJobError) {
  if (job.errors.length < MAX_STORED_ERRORS) job.errors.push(error)
}

function pushSkipped(job: LotJobInternal, skip: LotJobSkipped) {
  job.skippedCount++
  if (job.skipped.length < MAX_STORED_SKIPPED) job.skipped.push(skip)
}
