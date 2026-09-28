import {
  ensureAliquotaPercent,
  ensureLocalizacaoProduto,
  fetchProdutoIdByMigracaoOrBarcode,
  importarListaProdutos,
  insertCodigoBarraProduto,
  mapCsvRowToProductPayload,
} from '../tmsService.js'
import { parseBrazilianNumber, parseCodigoAdicionalList } from '../../utils/productFormats.js'
import {
  claimExistenceKey,
  confirmExistenceKey,
  lookupExistenceId,
  releaseExistenceKey,
} from './sendJobExistence.js'
import { MAX_STORED_ERRORS, type PreparedProductSend, type SendJobInternal } from './sendJobTypes.js'
import { sleep } from './sendJobWait.js'

export async function processOneBatch(
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
