import {
  cell,
  createOptionalJobRuntime,
  parseOptionalCsvText,
  parsePositiveEstoque,
  type OptionalJobInternal,
  type OptionalJobSnapshot,
  type OptionalJobStatus,
  type OptionalSendMode,
} from './optionalJobRuntime.js'
import {
  fetchProductExistenceCatalogs,
  resolveProdutoIdFromCsv,
  salvarListaEstoques,
  usableMigracaoCodigo,
} from './tmsService.js'

export type StockJobStatus = OptionalJobStatus
export type StockSendMode = OptionalSendMode

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

export type StockJobSnapshot = OptionalJobSnapshot<StockJobError, StockJobSkipped>

type StockJobInternal = OptionalJobInternal<StockJobError, StockJobSkipped>

const runtime = createOptionalJobRuntime<StockJobError, StockJobSkipped>()
/** Delphi: `not Produto.IsControlado` → tipoclassesngpc = tcNenhuma */
const NON_CONTROLLED = 'tcNenhuma'

export function getStockJob(jobId: string): StockJobSnapshot | null {
  return runtime.getJob(jobId)
}

export function parseStockCsvText(text: string): Record<string, string>[] {
  return parseOptionalCsvText(text)
}

export async function startStockJob(input: {
  rows: Record<string, string>[]
  tmsBaseUrl?: string
  mode?: StockSendMode
}): Promise<StockJobSnapshot> {
  return runtime.startJob(input, runStockJob)
}

export function cancelStockJob(jobId: string): StockJobSnapshot | null {
  return runtime.cancelJob(jobId)
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
      const estoque = parsePositiveEstoque(estoqueRaw)
      if (estoque === null) {
        runtime.pushSkipped(job, {
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
        runtime.pushError(job, {
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
        runtime.pushError(job, {
          index,
          codigo: codigo || codigobarras,
          message: `estoque/quantidade inválido (use inteiro > 0): ${estoqueRaw}`,
        })
        job.processed++
        continue
      }

      const migracao = usableMigracaoCodigo(codigo)
      const ref = migracao || codigobarras || codigo
      const produtoId = resolveProdutoIdFromCsv(existence, codigo, codigobarras)

      if (produtoId === undefined) {
        job.errorCount++
        runtime.pushError(job, {
          index,
          codigo: ref,
          message: migracao
            ? `Produto codigo_migracao=${migracao} não encontrado no banco`
            : `Produto com código de barras ${codigobarras} não encontrado no banco`,
        })
        job.processed++
        continue
      }

      // Delphi: Assigned(Produto) and not Produto.IsControlado → INT000 / MovimentarLote
      const tipoclasse =
        existence.tipoclassesngpcById.get(produtoId) ?? NON_CONTROLLED
      if (tipoclasse !== NON_CONTROLLED) {
        runtime.pushSkipped(job, {
          index,
          codigo: ref,
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

      // Delphi → XData: SalvarListaEstoques
      // 1) tenta por EAN; 2) se NaoImportado, tenta IdProduto.
      // CodigoMigracao no DTO (inteiro) — ecoado em Importado; sem ele o servidor devolve "0;qtd".
      const useBarras = Boolean(codigobarras)
      const migracaoRaw =
        migracao || existence.migracaoById.get(produtoId) || ''
      const migracaoNum = Number(migracaoRaw)
      const codigoMigracao =
        migracaoRaw !== '' && Number.isFinite(migracaoNum)
          ? Math.trunc(migracaoNum)
          : undefined

      const baseDto = {
        QuantidadeEstoque: estoque,
        IdFilial: job.idFilial,
        ...(codigoMigracao !== undefined ? { CodigoMigracao: codigoMigracao } : {}),
      }

      let result = await salvarListaEstoques(
        [
          useBarras
            ? {
                ...baseDto,
                IsCodigoBarra: true,
                CodigoBarras: codigobarras,
              }
            : {
                ...baseDto,
                IsCodigoBarra: false,
                IdProduto: produtoId,
              },
        ],
        job.tmsBaseUrl
      )

      let usedFallbackIdProduto = false
      if (useBarras && result.outcome === 'skipped_not_imported') {
        usedFallbackIdProduto = true
        result = await salvarListaEstoques(
          [
            {
              ...baseDto,
              IsCodigoBarra: false,
              IdProduto: produtoId,
            },
          ],
          job.tmsBaseUrl
        )
      }

      if (result.outcome === 'skipped_controlled') {
        const tipoclasse =
          existence.tipoclassesngpcById.get(produtoId) ?? NON_CONTROLLED
        runtime.pushSkipped(job, {
          index,
          codigo: ref,
          message:
            tipoclasse === NON_CONTROLLED
              ? 'servidor: NaoImportadoControlado (IsControlado=true), mas tipoclassesngpc=tcNenhuma — controlado por lista/outro flag; use Lotes'
              : `servidor: NaoImportadoControlado; tipoclassesngpc=${tipoclasse} — use Lotes`,
        })
        job.processed++
        continue
      }

      if (result.outcome === 'skipped_not_imported') {
        runtime.pushSkipped(job, {
          index,
          codigo: ref,
          message: usedFallbackIdProduto
            ? `não importado por EAN nem por IdProduto=${produtoId} (NaoImportado)`
            : 'não importado pelo servidor (NaoImportado) — produto/estoque rejeitado na regra do destino',
        })
        job.processed++
        continue
      }

      if (!result.ok || result.outcome !== 'imported') {
        job.errorCount++
        runtime.pushError(job, {
          index,
          codigo: ref,
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
    runtime.pushError(job, {
      index: -1,
      codigo: '',
      message: error instanceof Error ? error.message : 'Falha interna no job de estoque',
    })
  }
}
