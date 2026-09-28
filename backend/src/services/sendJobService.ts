import { randomUUID } from 'crypto'
import {
  auxiliaryMigracaoExists,
  ensureAliquotaPercent,
  ensureLocalizacaoProduto,
  fetchAuxiliaryExistenceCatalogs,
  fetchProdutoIdByMigracaoOrBarcode,
  fetchProductExistenceCatalogs,
  fetchProductLookupCatalogs,
  fetchServerIdentification,
  fetchTmsDcbCatalog,
  getDefaultTmsBaseUrl,
  importarListaProdutos,
  insertAuxiliaryEntity,
  insertCodigoBarraProduto,
  mapCsvRowToProductPayload,
  markAuxiliaryMigracaoExists,
  type AuxiliaryMigracaoEntity,
  type TmsAuxiliaryEntity,
} from './tmsService.js'
import { lookupAnvisaDcb, lookupAnvisaDcbByDescricao, padDcbCode } from './dcbIndexService.js'
import { TEMPLATE_DELIMITER } from '../schemas/product.schema.js'
import { parseBrazilianNumber, parseCodigoAdicionalList } from '../utils/productFormats.js'
import {
  claimExistenceKey,
  confirmExistenceKey,
  lookupExistenceId,
  releaseExistenceKey,
} from './send/sendJobExistence.js'
import { toSnapshot } from './send/sendJobSnapshot.js'
import {
  AUX_LABEL,
  JOB_TTL_MS,
  MAX_STORED_ERRORS,
  type AuxiliarySendRow,
  type PreparedProductSend,
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

async function insertAuxiliaries(job: SendJobInternal): Promise<void> {
  if (job.mode !== 'live' || job.auxiliaries.length === 0 || job.auxDone) return

  const remaining = job.auxiliaries.slice(job.auxInserted + job.auxFailed + job.auxSkipped)
  const needsDcbCatalog = remaining.some((item) => item.entity === 'dcb')
  const dcbCatalog = needsDcbCatalog ? await fetchTmsDcbCatalog(job.tmsBaseUrl) : null
  const existence = await fetchAuxiliaryExistenceCatalogs(job.tmsBaseUrl)

  for (const item of remaining) {
    if (job.cancelRequested) return
    while (job.pauseRequested && !job.cancelRequested) {
      job.status = 'paused'
      await sleep(200)
    }
    if (job.cancelRequested) return

    if (item.entity === 'dcb' && dcbCatalog) {
      // id do auxiliar ≠ código Anvisa: resolve pelo nome (ex.: Clonazepam → 02300).
      const byName = lookupAnvisaDcbByDescricao(item.descricao)
      const byCode = byName ? null : lookupAnvisaDcb(padDcbCode(item.codigo))
      const anvisa = byName ?? byCode
      if (!anvisa) {
        // Sem código Anvisa: não cadastra o auxiliar; produtos controlados
        // recebem aviso na hora do insert (DCB omitido no payload).
        job.auxSkipped++
        continue
      }

      const existing = dcbCatalog.get(anvisa.dcb) ?? dcbCatalog.get(padDcbCode(anvisa.dcb))
      if (existing) {
        job.auxSkipped++
        continue
      }

      const toInsert = {
        codigo: anvisa.dcb,
        descricao: anvisa.descricao,
      }
      const result = await insertAuxiliaryEntity('dcb', toInsert, job.tmsBaseUrl)
      if (result.ok) {
        job.auxInserted++
        dcbCatalog.set(anvisa.dcb, {
          id: '',
          dcb: anvisa.dcb,
          descricao: toInsert.descricao,
        })
        continue
      }
      job.auxFailed++
      if (job.errors.length < MAX_STORED_ERRORS) {
        job.errors.push({
          index: -1,
          codigo: anvisa.dcb,
          message: `DCB ${anvisa.dcb} (${toInsert.descricao}): ${result.message || 'falha no insert'}`,
          batch: 0,
        })
      }
      continue
    }

    if (item.entity === 'similar') {
      const key = item.descricao.trim().toLocaleUpperCase('pt-BR')
      if (existence.similarByDescricao.has(key)) {
        job.auxSkipped++
        continue
      }
      const result = await insertAuxiliaryEntity('similar', item, job.tmsBaseUrl)
      if (result.ok) {
        job.auxInserted++
        existence.similarByDescricao.add(key)
        continue
      }
      job.auxFailed++
      if (job.errors.length < MAX_STORED_ERRORS) {
        job.errors.push({
          index: -1,
          codigo: item.codigo,
          message: `Similar ${item.codigo} (${item.descricao}): ${result.message || 'falha no insert'}`,
          batch: 0,
        })
      }
      continue
    }

    const migracaoEntity = item.entity as AuxiliaryMigracaoEntity
    if (auxiliaryMigracaoExists(existence, migracaoEntity, item.codigo)) {
      job.auxSkipped++
      continue
    }

    const result = await insertAuxiliaryEntity(item.entity, item, job.tmsBaseUrl)
    if (result.ok) {
      job.auxInserted++
      markAuxiliaryMigracaoExists(existence, migracaoEntity, item.codigo)
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

  const catalogs = job.productCatalogs
  const existence = job.productExistence
  if (!catalogs || !existence) {
    for (const index of indexes) {
      job.errorCount++
      job.failedIndexes.push(index)
      if (job.errors.length < MAX_STORED_ERRORS) {
        job.errors.push({
          index,
          codigo: String(job.rows[index]?.codigo ?? ''),
          message: 'Catálogos do banco não carregados para mapear o produto',
          batch: batchNumber,
        })
      }
      job.processed++
    }
    return
  }

  const prepared: PreparedProductSend[] = []

  for (let i = 0; i < indexes.length; i++) {
    if (job.cancelRequested) break
    while (job.pauseRequested && !job.cancelRequested) {
      job.status = 'paused'
      await sleep(200)
    }
    if (job.cancelRequested) break

    const index = indexes[i]
    const row = job.rows[index]
    const codigo = String(row.codigo ?? '').trim()
    const barcode = String(row.codigobarras ?? '').trim()
    const nome = String(row.nome ?? '').trim()
    const additionalBarcodes = parseCodigoAdicionalList(
      String(row.codigoadicional ?? ''),
      barcode
    )

    const existingMigracaoId = codigo
      ? lookupExistenceId(existence.byMigracao, codigo)
      : undefined
    if (existingMigracaoId !== undefined) {
      job.skipped.push({
        index,
        codigo,
        nome,
        codigobarras: barcode,
        reason: 'codigo_migracao',
        message:
          existingMigracaoId > 0
            ? `codigo_migracao já existe no produto (banco id ${existingMigracaoId})`
            : 'codigo_migracao duplicado neste envio',
        tmsProdutoId: existingMigracaoId > 0 ? existingMigracaoId : null,
      })
      job.processed++
      continue
    }

    if (barcode) {
      const existingBarcodeId = lookupExistenceId(existence.byBarcode, barcode)
      if (existingBarcodeId !== undefined) {
        job.skipped.push({
          index,
          codigo,
          nome,
          codigobarras: barcode,
          reason: 'codigo_barras',
          message:
            existingBarcodeId > 0
              ? `código de barras já existe no produto (banco id ${existingBarcodeId})`
              : 'código de barras duplicado neste envio',
          tmsProdutoId: existingBarcodeId > 0 ? existingBarcodeId : null,
        })
        job.processed++
        continue
      }
    }

    if (codigo && !claimExistenceKey(existence.byMigracao, codigo)) {
      const id = lookupExistenceId(existence.byMigracao, codigo)
      job.skipped.push({
        index,
        codigo,
        nome,
        codigobarras: barcode,
        reason: 'codigo_migracao',
        message:
          id && id > 0
            ? `codigo_migracao já existe no produto (banco id ${id})`
            : 'codigo_migracao duplicado neste envio',
        tmsProdutoId: id && id > 0 ? id : null,
      })
      job.processed++
      continue
    }
    if (barcode && !claimExistenceKey(existence.byBarcode, barcode)) {
      const id = lookupExistenceId(existence.byBarcode, barcode)
      if (codigo) releaseExistenceKey(existence.byMigracao, codigo)
      job.skipped.push({
        index,
        codigo,
        nome,
        codigobarras: barcode,
        reason: 'codigo_barras',
        message:
          id && id > 0
            ? `código de barras já existe no produto (banco id ${id})`
            : 'código de barras duplicado neste envio',
        tmsProdutoId: id && id > 0 ? id : null,
      })
      job.processed++
      continue
    }

    const aliquotaNum = parseBrazilianNumber(String(row.aliquota ?? ''))
    if (aliquotaNum !== null && aliquotaNum !== 0) {
      const ensured = await ensureAliquotaPercent(catalogs, aliquotaNum, job.tmsBaseUrl)
      if (!ensured.ok) {
        if (codigo) releaseExistenceKey(existence.byMigracao, codigo)
        if (barcode) releaseExistenceKey(existence.byBarcode, barcode)
        job.errorCount++
        job.failedIndexes.push(index)
        if (job.errors.length < MAX_STORED_ERRORS) {
          job.errors.push({
            index,
            codigo,
            message: ensured.message || `Falha ao garantir AliquotaICMS ${aliquotaNum}%`,
            batch: batchNumber,
          })
        }
        job.processed++
        continue
      }
    }

    const localizacaoRaw = String(row.localizacao ?? '').trim()
    if (localizacaoRaw) {
      const ensuredLoc = await ensureLocalizacaoProduto(
        catalogs,
        localizacaoRaw,
        job.tmsBaseUrl
      )
      if (!ensuredLoc.ok) {
        if (codigo) releaseExistenceKey(existence.byMigracao, codigo)
        if (barcode) releaseExistenceKey(existence.byBarcode, barcode)
        job.errorCount++
        job.failedIndexes.push(index)
        if (job.errors.length < MAX_STORED_ERRORS) {
          job.errors.push({
            index,
            codigo,
            message:
              ensuredLoc.message ||
              `Falha ao garantir LocalizacaoProduto "${localizacaoRaw}"`,
            batch: batchNumber,
          })
        }
        job.processed++
        continue
      }
    }

    const mapped = mapCsvRowToProductPayload(row, job.idFilial, catalogs)

    if (!mapped.ok) {
      if (codigo) releaseExistenceKey(existence.byMigracao, codigo)
      if (barcode) releaseExistenceKey(existence.byBarcode, barcode)
      job.errorCount++
      job.failedIndexes.push(index)
      if (job.errors.length < MAX_STORED_ERRORS) {
        job.errors.push({
          index,
          codigo,
          message: mapped.message,
          batch: batchNumber,
        })
      }
      job.processed++
      continue
    }

    prepared.push({
      index,
      codigo,
      barcode,
      additionalBarcodes,
      payload: mapped.payload,
      warnings: mapped.warnings ?? [],
    })
  }

  if (prepared.length === 0 || job.cancelRequested) return

  const listaResult = await importarListaProdutos(
    prepared.map((item) => item.payload),
    job.tmsBaseUrl,
    false
  )

  const errorsByMigracao = new Map<string, string>()
  for (const err of listaResult.itemErrors ?? []) {
    errorsByMigracao.set(err.codigoMigracao, err.message)
  }

  const batchFailed =
    !listaResult.ok && (listaResult.itemErrors?.length ?? 0) === 0 && prepared.length > 0

  const needExtraBarcodes: PreparedProductSend[] = []

  for (const item of prepared) {
    const migracaoKey = String(item.payload.codigo_migracao ?? item.codigo).trim()
    const itemError = errorsByMigracao.get(migracaoKey)

    if (batchFailed || itemError) {
      if (item.codigo) releaseExistenceKey(existence.byMigracao, item.codigo)
      if (item.barcode) releaseExistenceKey(existence.byBarcode, item.barcode)
      job.errorCount++
      job.failedIndexes.push(item.index)
      if (job.errors.length < MAX_STORED_ERRORS) {
        job.errors.push({
          index: item.index,
          codigo: item.codigo,
          message:
            itemError ||
            listaResult.message ||
            'Falha na importação em lote (ImportarListaProdutos)',
          batch: batchNumber,
        })
      }
    } else {
      job.successCount++
      if (item.codigo) confirmExistenceKey(existence.byMigracao, item.codigo, -1)
      if (item.barcode) confirmExistenceKey(existence.byBarcode, item.barcode, -1)
      for (const warning of item.warnings) {
        if (job.errors.length < MAX_STORED_ERRORS) {
          job.errors.push({
            index: item.index,
            codigo: item.codigo,
            message: `Aviso: ${warning}`,
            batch: batchNumber,
          })
        }
      }
      if (item.additionalBarcodes.length > 0) {
        needExtraBarcodes.push(item)
      }
    }
    job.processed++
  }

  for (const item of needExtraBarcodes) {
    if (job.cancelRequested) break
    const produtoId = await fetchProdutoIdByMigracaoOrBarcode(
      item.codigo,
      item.barcode,
      job.tmsBaseUrl
    )
    if (produtoId === undefined) {
      if (job.errors.length < MAX_STORED_ERRORS) {
        job.errors.push({
          index: item.index,
          codigo: item.codigo,
          message:
            'Produto importado, mas não foi possível localizar o id no banco para cadastrar codigoadicional',
          batch: batchNumber,
        })
      }
      continue
    }

    for (const extra of item.additionalBarcodes) {
      if (lookupExistenceId(existence.byBarcode, extra) !== undefined) {
        if (job.errors.length < MAX_STORED_ERRORS) {
          job.errors.push({
            index: item.index,
            codigo: item.codigo,
            message: `Aviso: código adicional ${extra} já existe — não cadastrado de novo`,
            batch: batchNumber,
          })
        }
        continue
      }

      const insertResult = await insertCodigoBarraProduto(
        produtoId,
        { codigoBarra: extra, fator: 1 },
        job.tmsBaseUrl
      )
      if (!insertResult.ok) {
        if (job.errors.length < MAX_STORED_ERRORS) {
          job.errors.push({
            index: item.index,
            codigo: item.codigo,
            message: `Aviso: falha ao cadastrar código adicional ${extra}: ${
              insertResult.message || 'erro TMS'
            }`,
            batch: batchNumber,
          })
        }
        continue
      }
      confirmExistenceKey(existence.byBarcode, extra, produtoId)
    }
  }
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
    phase:
      mode === 'live' && auxiliaries.length > 0 ? 'auxiliaries' : 'products',
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
