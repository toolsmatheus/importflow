import {
  cell,
  criarRuntimeOpcionalJob,
  parseOptionalCsvText,
  type OptionalJobInternal,
  type OptionalJobSnapshot,
  type OptionalJobStatus,
  type OptionalModoEnvio,
} from './opcional-runtime.service.js'
import type {
  BarcodeExtraJobError,
  BarcodeExtraJobSkipped,
} from '../models/opcional.model.js'
import {
  buscarCatalogosExistenciaProduto,
  fetchCodigoBarraProdutoRows,
  insertCodigoBarraProduto,
  resolveProdutoIdFromCsv,
  usableMigracaoCodigo,
} from './tms.service.js'
import { parseBrazilianNumber } from '../utils/productFormats.js'

export type BarcodeExtraJobStatus = OptionalJobStatus
export type BarcodeExtraModoEnvio = OptionalModoEnvio
export type { BarcodeExtraJobError, BarcodeExtraJobSkipped }

export type BarcodeExtraJobSnapshot = OptionalJobSnapshot<
  BarcodeExtraJobError,
  BarcodeExtraJobSkipped
>

type BarcodeExtraJobInternal = OptionalJobInternal<
  BarcodeExtraJobError,
  BarcodeExtraJobSkipped
>

const runtime = criarRuntimeOpcionalJob<BarcodeExtraJobError, BarcodeExtraJobSkipped>()

export function obterBarrasJob(jobId: string): BarcodeExtraJobSnapshot | null {
  return runtime.getJob(jobId)
}

export function parseBarcodeExtraCsvText(text: string): Record<string, string>[] {
  return parseOptionalCsvText(text)
}

export async function iniciarBarrasJob(input: {
  rows: Record<string, string>[]
  tmsBaseUrl?: string
  mode?: BarcodeExtraModoEnvio
}): Promise<BarcodeExtraJobSnapshot> {
  return runtime.startJob(input, runBarcodeExtraJob)
}

export function cancelarBarrasJob(jobId: string): BarcodeExtraJobSnapshot | null {
  return runtime.cancelJob(jobId)
}

/** Fator opcional: vazio → 1; precisa ser inteiro ≥ 0. */
export function parseFatorCodigoBarra(raw: string): number | null {
  if (!raw.trim()) return 1
  const parsed = parseBrazilianNumber(raw)
  if (parsed === null || !Number.isFinite(parsed) || parsed < 0) return null
  const asInt = Math.round(parsed)
  if (Math.abs(parsed - asInt) > 0.001) return null
  return asInt
}

function barcodeKey(value: string): string {
  const t = value.trim()
  if (!t) return ''
  const digits = t.replace(/\D/g, '')
  return digits || t
}

function addBarcodeKey(set: Set<string>, value: string) {
  const key = barcodeKey(value)
  if (key) set.add(key)
  if (value.trim()) set.add(value.trim())
}

async function runBarcodeExtraJob(job: BarcodeExtraJobInternal): Promise<void> {
  job.status = 'running'
  job.startedAt = Date.now()

  try {
    const existence = await buscarCatalogosExistenciaProduto(job.tmsBaseUrl)
    const existingBarcodes = new Set<string>()
    for (const key of existence.byBarcode.keys()) {
      addBarcodeKey(existingBarcodes, key)
    }
    for (const row of await fetchCodigoBarraProdutoRows(job.tmsBaseUrl)) {
      addBarcodeKey(existingBarcodes, row.codigoBarra)
    }

    for (let index = 0; index < job.rows.length; index++) {
      if (job.cancelRequested) {
        job.status = 'cancelled'
        job.finishedAt = Date.now()
        return
      }

      const row = job.rows[index]
      const codigo = cell(row, 'codigo_migracao', 'codigomigracao', 'codigo')
      const codigobarras = cell(row, 'codigobarra', 'codigo_barra', 'codigobarras')
      const codigoadicional = cell(row, 'codigoadicional', 'codigo_adicional')
      const fatorRaw = cell(row, 'fator')
      const fator = parseFatorCodigoBarra(fatorRaw)
      const ref = usableMigracaoCodigo(codigo) || codigobarras || codigo

      if (!codigoadicional) {
        job.errorCount++
        runtime.pushError(job, {
          index,
          codigo: ref,
          message: 'codigoadicional obrigatório',
        })
        job.processed++
        continue
      }

      if (!codigo && !codigobarras) {
        job.errorCount++
        runtime.pushError(job, {
          index,
          codigo: '',
          message:
            'Informe codigo_migracao ou codigobarra para localizar o produto',
        })
        job.processed++
        continue
      }

      if (fator === null) {
        job.errorCount++
        runtime.pushError(job, {
          index,
          codigo: ref,
          message: `fator inválido (use inteiro ≥ 0): ${fatorRaw || '(vazio)'}`,
        })
        job.processed++
        continue
      }

      const migracao = usableMigracaoCodigo(codigo)
      const produtoId = resolveProdutoIdFromCsv(existence, codigo, codigobarras)

      if (produtoId === undefined) {
        job.errorCount++
        const triedMigracao = Boolean(migracao)
        const triedBarcode = Boolean(codigobarras)
        let message: string
        if (triedMigracao && triedBarcode) {
          message = `Produto não encontrado (codigo_migracao=${migracao}, codigobarra=${codigobarras})`
        } else if (triedMigracao) {
          message = `Produto codigo_migracao=${migracao} não encontrado no banco`
        } else {
          message = `Produto com código de barras ${codigobarras} não encontrado no banco`
        }
        runtime.pushError(job, {
          index,
          codigo: ref,
          message,
        })
        job.processed++
        continue
      }

      const extraKey = barcodeKey(codigoadicional)
      if (existingBarcodes.has(extraKey) || existingBarcodes.has(codigoadicional)) {
        runtime.pushSkipped(job, {
          index,
          codigo: ref,
          message: `código adicional ${codigoadicional} já cadastrado — ignorado`,
        })
        job.processed++
        continue
      }

      if (job.mode === 'simulate') {
        addBarcodeKey(existingBarcodes, codigoadicional)
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
        runtime.pushError(job, {
          index,
          codigo: ref,
          message: result.message || 'Falha ao inserir código de barras adicional',
        })
        job.processed++
        continue
      }

      addBarcodeKey(existingBarcodes, codigoadicional)
      job.successCount++
      job.processed++
    }

    job.status = 'completed'
    job.finishedAt = Date.now()
  } catch (error) {
    job.status = 'failed'
    job.finishedAt = Date.now()
    runtime.pushError(job, {
      index: -1,
      codigo: '',
      message:
        error instanceof Error
          ? error.message
          : 'Falha interna no job de códigos de barras adicionais',
    })
  }
}
