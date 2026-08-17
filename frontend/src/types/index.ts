export interface ConnectionConfig {
  name: string
  host: string
  port: number
  database: string
  user: string
  password: string
}

export interface ConnectionTestResult {
  success: boolean
  host?: string
  port?: number
  database?: string
  responseTimeMs?: number
  sessionId?: string
  connectionName?: string
  message?: string
}

export interface CsvAnalysis {
  fileId: string
  fileName: string
  fileSize: number
  recordCount: number
  columnCount: number
  encoding: string
  delimiter: string
  hasHeader: boolean
  columns: string[]
}

export interface TableColumn {
  name: string
  type: string
  columnType: string
  nullable: boolean
  key: string
  maxLength: number | null
  numericPrecision: number | null
  numericScale: number | null
  defaultValue: string | null
  autoIncrement: boolean
}

export interface ColumnMapping {
  csvColumn: string
  mysqlColumn: string | null
  suggested?: boolean
}

export type ImportMode = 'insert' | 'update' | 'upsert'

export interface PreviewRow {
  [key: string]: string
}

export interface ValidationError {
  row: number
  field: string
  value: string
  message: string
  severity: 'error' | 'warning'
}

export interface ValidationResult {
  totalRecords: number
  validCount: number
  warningCount: number
  invalidCount: number
  missingRequiredColumns: string[]
  duplicateKeyColumns: string[]
  errors: ValidationError[]
  truncatedErrors: boolean
  previewRows: PreviewRow[]
  previewColumns: string[]
}

export interface ImportProgress {
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

export interface ImportResult {
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

export interface ImportError {
  row: number
  field: string
  value: string
  message: string
}

export interface ImportWizardState {
  connection: ConnectionConfig | null
  connectionTested: boolean
  connectionResult: ConnectionTestResult | null
  csvAnalysis: CsvAnalysis | null
  selectedTable: string | null
  columnMappings: ColumnMapping[]
  importMode: ImportMode
  validationResult: ValidationResult | null
  importProgress: ImportProgress | null
  importResult: ImportResult | null
}

export type WizardStep = 'connection' | 'file' | 'mapping' | 'review' | 'import'
