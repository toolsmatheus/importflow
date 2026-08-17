import { z } from 'zod'

export const importModeSchema = z.enum(['insert', 'update', 'upsert'])

export const columnMappingSchema = z.object({
  csvColumn: z.string().min(1),
  mysqlColumn: z.string().min(1).nullable(),
})

export const validateImportSchema = z.object({
  fileId: z.string().uuid(),
  table: z.string().min(1),
  mappings: z.array(columnMappingSchema).min(1),
  delimiter: z.string().min(1).max(1).optional(),
  encoding: z.string().min(1).optional(),
  hasHeader: z.coerce.boolean().optional(),
})

export const startImportSchema = validateImportSchema.extend({
  mode: importModeSchema,
  /** Apenas para calcular o percentual de progresso; vem da validação do mesmo arquivo. */
  totalRecords: z.coerce.number().int().positive().optional(),
})

export type ImportMode = z.infer<typeof importModeSchema>
export type ColumnMappingInput = z.infer<typeof columnMappingSchema>
export type ValidateImportInput = z.infer<typeof validateImportSchema>
export type StartImportInput = z.infer<typeof startImportSchema>

export interface ImportErrorRow {
  row: number
  field: string
  value: string
  message: string
}

export interface ImportProgressPayload {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  processed: number
  total: number
  inserted: number
  updated: number
  skipped: number
  errors: number
  elapsedSeconds: number
  message?: string
}

export interface ImportResultPayload {
  id: string
  status: 'completed' | 'failed'
  totalProcessed: number
  inserted: number
  updated: number
  skipped: number
  errors: number
  durationSeconds: number
  message?: string
}

export interface ValidationIssueRow {
  row: number
  field: string
  value: string
  message: string
  severity: 'error' | 'warning'
}

export interface ValidationResultPayload {
  totalRecords: number
  validCount: number
  warningCount: number
  invalidCount: number
  missingRequiredColumns: string[]
  duplicateKeyColumns: string[]
  errors: ValidationIssueRow[]
  truncatedErrors: boolean
  previewRows: Record<string, string>[]
  previewColumns: string[]
}
