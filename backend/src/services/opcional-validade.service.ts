import {
  cell,
  criarRuntimeOpcionalJob,
  parseOptionalCsvText,
  parseValidityDate,
  type OptionalJobInternal,
  type OptionalJobSnapshot,
  type OptionalJobStatus,
  type OptionalModoEnvio,
} from './opcional-runtime.service.js'
import type { ValidityJobError, ValidityJobSkipped } from '../models/opcional.model.js'
import {
  buscarCatalogosExistenciaProduto,
  insertValidadeSistemaAntigo,
} from './tms.service.js'

export type ValidityJobStatus = OptionalJobStatus
export type ValidityModoEnvio = OptionalModoEnvio

/** Reexport — lotes e outros consumidores já usavam este módulo. */
export { parseValidityDate }

export type { ValidityJobError, ValidityJobSkipped }

export type ValidityJobSnapshot = OptionalJobSnapshot<
  ValidityJobError,
  ValidityJobSkipped
>

type ValidityJobInternal = OptionalJobInternal<ValidityJobError, ValidityJobSkipped>

const runtime = criarRuntimeOpcionalJob<ValidityJobError, ValidityJobSkipped>()
const NON_CONTROLLED = 'tcNenhuma'

export function obterValidadeJob(jobId: string): ValidityJobSnapshot | null {
  return runtime.getJob(jobId)
}

export function parseValidityCsvText(text: string): Record<string, string>[] {
  return parseOptionalCsvText(text)
}

export async function iniciarValidadeJob(input: {
  rows: Record<string, string>[]
  tmsBaseUrl?: string
  mode?: ValidityModoEnvio
}): Promise<ValidityJobSnapshot> {
  return runtime.startJob(input, runValidityJob)
}

export function cancelarValidadeJob(jobId: string): ValidityJobSnapshot | null {
  return runtime.cancelJob(jobId)
}

function parseQuantidade(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s/g, '')
  if (!cleaned) return null
  const n = Number(cleaned.replace(',', '.'))
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return null
  return n
}

async function runValidityJob(job: ValidityJobInternal): Promise<void> {
  job.status = 'running'
  job.startedAt = Date.now()

  try {
    const existence = await buscarCatalogosExistenciaProduto(job.tmsBaseUrl)

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
        runtime.pushError(job, {
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
        runtime.pushError(job, {
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
        runtime.pushError(job, {
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
        runtime.pushError(job, {
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
        runtime.pushSkipped(job, {
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
        runtime.pushError(job, {
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
    runtime.pushError(job, {
      index: -1,
      codigo: '',
      message:
        error instanceof Error ? error.message : 'Falha interna no job de validade',
    })
  }
}
