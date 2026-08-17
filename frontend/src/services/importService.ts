import { apiRequest } from '@/lib/api'
import type {
  ColumnMapping,
  ValidationResult,
  ImportProgress,
  ImportResult,
  ImportError,
  ImportMode,
} from '@/types'

export interface ValidateParams {
  sessionId: string
  fileId: string
  table: string
  mappings: ColumnMapping[]
  delimiter?: string
  encoding?: string
  hasHeader?: boolean
}

export interface StartImportParams extends ValidateParams {
  mode: ImportMode
  totalRecords?: number
}

export interface ImportErrorsResponse {
  total: number
  truncated: boolean
  errors: ImportError[]
}

function buildPayload(params: ValidateParams) {
  return {
    fileId: params.fileId,
    table: params.table,
    mappings: params.mappings.map((mapping) => ({
      csvColumn: mapping.csvColumn,
      mysqlColumn: mapping.mysqlColumn,
    })),
    delimiter: params.delimiter,
    encoding: params.encoding,
    hasHeader: params.hasHeader,
  }
}

export const importService = {
  async validate(params: ValidateParams): Promise<ValidationResult> {
    return apiRequest<ValidationResult>('/import/validate', {
      method: 'POST',
      sessionId: params.sessionId,
      body: JSON.stringify(buildPayload(params)),
    })
  },

  async startImport(params: StartImportParams): Promise<{ importId: string }> {
    return apiRequest<{ importId: string }>('/import/start', {
      method: 'POST',
      sessionId: params.sessionId,
      body: JSON.stringify({
        ...buildPayload(params),
        mode: params.mode,
        totalRecords: params.totalRecords,
      }),
    })
  },

  async getStatus(importId: string, sessionId: string): Promise<ImportProgress> {
    return apiRequest<ImportProgress>(`/import/status/${importId}`, { sessionId })
  },

  async getResult(importId: string, sessionId: string): Promise<ImportResult> {
    return apiRequest<ImportResult>(`/import/${importId}/result`, { sessionId })
  },

  async getErrors(importId: string, sessionId: string): Promise<ImportErrorsResponse> {
    return apiRequest<ImportErrorsResponse>(`/import/${importId}/errors`, { sessionId })
  },
}
