import {
  cell,
  createOptionalJobRuntime,
  parseOptionalCsvText,
  parsePositiveEstoque,
  parseValidityDate,
  type OptionalJobInternal,
  type OptionalJobSnapshot,
  type OptionalJobStatus,
  type OptionalSendMode,
} from './optionalJobRuntime.js'
import {
  fetchProductExistenceCatalogs,
  findLoteMedicamento,
  findRegistroMsId,
  insertLoteMedicamento,
  resolveProdutoIdFromCsv,
  setLoteMedicamentoQuantidade,
  usableMigracaoCodigo,
} from './tmsService.js'

export type LotJobStatus = OptionalJobStatus
export type LotSendMode = OptionalSendMode

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

export type LotJobSnapshot = OptionalJobSnapshot<LotJobError, LotJobSkipped>

type LotJobInternal = OptionalJobInternal<LotJobError, LotJobSkipped>

const runtime = createOptionalJobRuntime<LotJobError, LotJobSkipped>()
const NON_CONTROLLED = 'tcNenhuma'

export function getLotJob(jobId: string): LotJobSnapshot | null {
  return runtime.getJob(jobId)
}

export function parseLotCsvText(text: string): Record<string, string>[] {
  return parseOptionalCsvText(text)
}

export async function startLotJob(input: {
  rows: Record<string, string>[]
  tmsBaseUrl?: string
  mode?: LotSendMode
}): Promise<LotJobSnapshot> {
  return runtime.startJob(input, runLotJob)
}

export function cancelLotJob(jobId: string): LotJobSnapshot | null {
  return runtime.cancelJob(jobId)
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
        runtime.pushError(job, {
          index,
          codigo: '',
          message: 'Informe codigo (migração) ou codigobarras',
        })
        job.processed++
        continue
      }

      if (!lote) {
        job.errorCount++
        runtime.pushError(job, {
          index,
          codigo: codigo || codigobarras,
          message: 'lote obrigatório',
        })
        job.processed++
        continue
      }

      if (!registroms) {
        job.errorCount++
        runtime.pushError(job, {
          index,
          codigo: codigo || codigobarras,
          message: 'registroms obrigatório',
        })
        job.processed++
        continue
      }

      const estoque = parsePositiveEstoque(estoqueRaw)
      if (estoque === null) {
        runtime.pushSkipped(job, {
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
        runtime.pushError(job, {
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
        runtime.pushError(job, {
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
        runtime.pushError(job, {
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

      const tipoclasse =
        existence.tipoclassesngpcById.get(produtoId) ?? NON_CONTROLLED
      if (tipoclasse === NON_CONTROLLED) {
        runtime.pushSkipped(job, {
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
            runtime.pushError(job, {
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
        runtime.pushSkipped(job, {
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
        runtime.pushError(job, {
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
    runtime.pushError(job, {
      index: -1,
      codigo: '',
      message: error instanceof Error ? error.message : 'Falha interna no job de lotes',
    })
  }
}
