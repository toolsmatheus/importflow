import {
  cell,
  criarRuntimeOpcionalJob,
  parseOptionalCsvText,
  type OptionalJobInternal,
  type OptionalJobSnapshot,
  type OptionalJobStatus,
  type OptionalModoEnvio,
} from './opcional-runtime.service.js'
import type { SupplierJobError, SupplierJobSkipped } from '../models/opcional.model.js'
import {
  favorecidoMigracaoExists,
  fetchFavorecidoMigracaoKeys,
  fetchProductCodigoFornecedorKeys,
  buscarCatalogosExistenciaProduto,
  insertCodigoFornecedor,
  parseFavorecidoMigracao,
  resolveProdutoIdFromCsv,
  usableMigracaoCodigo,
} from './tms.service.js'
import { parseBrazilianNumber } from '../utils/productFormats.js'

export type SupplierJobStatus = OptionalJobStatus
export type SupplierModoEnvio = OptionalModoEnvio
export type { SupplierJobError, SupplierJobSkipped }

export type SupplierJobSnapshot = OptionalJobSnapshot<
  SupplierJobError,
  SupplierJobSkipped
>

type SupplierJobInternal = OptionalJobInternal<SupplierJobError, SupplierJobSkipped>

const runtime = criarRuntimeOpcionalJob<SupplierJobError, SupplierJobSkipped>()

function supplierKey(favorecidoMigracao: number, codigoOriginal: string): string {
  return `${favorecidoMigracao}|${codigoOriginal}`
}

export function obterFornecedorJob(jobId: string): SupplierJobSnapshot | null {
  return runtime.getJob(jobId)
}

export function parseSupplierCsvText(text: string): Record<string, string>[] {
  return parseOptionalCsvText(text)
}

export async function iniciarFornecedorJob(input: {
  rows: Record<string, string>[]
  tmsBaseUrl?: string
  mode?: SupplierModoEnvio
}): Promise<SupplierJobSnapshot> {
  return runtime.startJob(input, runSupplierJob)
}

export function cancelarFornecedorJob(jobId: string): SupplierJobSnapshot | null {
  return runtime.cancelJob(jobId)
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
    const existence = await buscarCatalogosExistenciaProduto(job.tmsBaseUrl)
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
        runtime.pushError(job, {
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
        runtime.pushError(job, {
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
        runtime.pushError(job, {
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
        runtime.pushError(job, {
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
        runtime.pushError(job, {
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
        runtime.pushError(job, {
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
        runtime.pushError(job, {
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
        runtime.pushSkipped(job, {
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
        runtime.pushError(job, {
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
    runtime.pushError(job, {
      index: -1,
      codigo: '',
      codigofornecedor: '',
      message:
        error instanceof Error ? error.message : 'Falha interna no job de códigos de fornecedor',
    })
  }
}
