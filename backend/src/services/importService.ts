import type {
  StartImportInput,
  ValidateImportInput,
  ValidationResultPayload,
} from '../schemas/import.schema.js'
import { deleteStoredFile, getStoredFile } from './csvFileService.js'
import { resolveCsvOptions } from './csvService.js'
import { runImport } from './importExecutor.js'
import { createJob, finishJob, type ImportJob } from './importJobService.js'
import { getTableColumns } from './mysqlService.js'
import { buildActiveMappings, findMissingRequiredColumns, validateImport } from './validationService.js'

export type ServiceFailure = { success: false; message: string; status: number }
export type ServiceSuccess<T> = { success: true; data: T }
export type ServiceResult<T> = ServiceSuccess<T> | ServiceFailure

export async function runValidation(
  sessionId: string,
  input: ValidateImportInput
): Promise<ServiceResult<ValidationResultPayload>> {
  const file = getStoredFile(input.fileId)
  if (!file) {
    return {
      success: false,
      message: 'Arquivo não encontrado. Faça o upload novamente.',
      status: 404,
    }
  }

  const columnsResult = await getTableColumns(sessionId, input.table)
  if (!columnsResult.success) {
    return { success: false, message: columnsResult.message, status: columnsResult.status }
  }

  const active = buildActiveMappings(input.mappings, columnsResult.columns)
  if (active.length === 0) {
    return {
      success: false,
      message: 'Nenhuma coluna mapeada. Configure o mapeamento antes de validar.',
      status: 400,
    }
  }

  const options = await resolveCsvOptions(file.filePath, {
    delimiter: input.delimiter,
    encoding: input.encoding,
    hasHeader: input.hasHeader,
  })

  const result = await validateImport(file, options, active, columnsResult.columns)

  return { success: true, data: result }
}

export async function startImport(
  sessionId: string,
  input: StartImportInput,
  onFinish?: (job: ImportJob) => void
): Promise<ServiceResult<ImportJob>> {
  const file = getStoredFile(input.fileId)
  if (!file) {
    return {
      success: false,
      message: 'Arquivo não encontrado. Faça o upload novamente.',
      status: 404,
    }
  }

  const columnsResult = await getTableColumns(sessionId, input.table)
  if (!columnsResult.success) {
    return { success: false, message: columnsResult.message, status: columnsResult.status }
  }

  const active = buildActiveMappings(input.mappings, columnsResult.columns)
  if (active.length === 0) {
    return {
      success: false,
      message: 'Nenhuma coluna mapeada. Configure o mapeamento antes de importar.',
      status: 400,
    }
  }

  const missing = findMissingRequiredColumns(active, columnsResult.columns)
  if (missing.length > 0 && input.mode !== 'update') {
    return {
      success: false,
      message: `Colunas obrigatórias sem mapeamento: ${missing.join(', ')}.`,
      status: 400,
    }
  }

  const job = createJob(input.table, input.mode, input.totalRecords ?? 0)

  // Roda em background: a resposta HTTP devolve o id e o cliente acompanha via /status.
  void runImport(job, sessionId, input, file, active)
    .catch(() => finishJob(job, 'failed', 'Erro inesperado durante a importação.'))
    .finally(() => {
      // Importação concluída: o arquivo do usuário não é mais necessário. Em caso de
      // falha ele é mantido para permitir uma nova tentativa sem reenviar o CSV.
      if (job.status === 'completed') {
        deleteStoredFile(input.fileId)
      }
      onFinish?.(job)
    })

  return { success: true, data: job }
}
