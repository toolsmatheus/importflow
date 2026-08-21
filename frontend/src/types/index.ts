export type WizardStep =
  | 'template'
  | 'file'
  | 'auxiliary'
  | 'errors'
  | 'preview'
  | 'send'

export type IssueSeverity = 'error' | 'warning'

export type AuxiliaryEntity =
  | 'grupo'
  | 'subgrupo'
  | 'categoria'
  | 'laboratorio'
  | 'grupodepreco'
  | 'similar'
  | 'dcb'

export interface ValidationIssue {
  row: number
  field: string
  value: string
  message: string
  severity: IssueSeverity
}

export interface ProductValidationResult {
  fileId: string
  fileName: string
  totalRecords: number
  errorCount: number
  warningCount: number
  missingRequiredHeaders: string[]
  unknownHeaders: string[]
  presentOptionalHeaders: string[]
  canProceed: boolean
  issues: ValidationIssue[]
  truncated: boolean
  columns: string[]
  rows: Record<string, string>[]
}

export interface AuxiliaryUploadResult {
  entity: AuxiliaryEntity
  fileId: string
  fileName: string
  fileSize: number
  recordCount: number
  parseWarnings: string[]
}

export interface ProductFieldCatalog {
  required: string[]
  optional: string[]
  farmaciaPopular: string[]
  controlados: string[]
  listapiscofins: string[]
  auxiliaryEntities: AuxiliaryEntity[]
  delimiter: string
  markupFormula: string
  tmsBaseUrl: string
  rules: {
    controladoSemDcb: string
    csosnECsticmsJuntos: string
    markupInconsistente: string
  }
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

export type SendJobStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type SendMode = 'live' | 'simulate'

export interface SendJobError {
  index: number
  codigo: string
  message: string
  batch: number
}

export interface SendJobSnapshot {
  id: string
  status: SendJobStatus
  mode: SendMode
  tmsBaseUrl: string
  idFilial: number
  batchSize: number
  concurrency: number
  total: number
  processed: number
  successCount: number
  errorCount: number
  currentBatch: number
  totalBatches: number
  errors: SendJobError[]
  errorsTruncated: boolean
  startedAt: string | null
  finishedAt: string | null
  elapsedMs: number
  productsPerSecond: number
  percent: number
  remaining: number
}

export interface FolderCollectResult {
  folderPath: string
  products: CsvAnalysis | null
  auxiliaries: Partial<Record<AuxiliaryEntity, AuxiliaryUploadResult>>
  found: { role: string; fileName: string }[]
  missing: string[]
  ignored: string[]
}

export type FileInputMode = 'manual' | 'folder'

/** @deprecated Prefer SendJobSnapshot */
export type TmsSendResult = Pick<
  SendJobSnapshot,
  'idFilial' | 'total' | 'successCount' | 'errorCount'
> & {
  errors: { index: number; codigo: string; message: string }[]
}
