export type WizardStep =
  | 'file'
  | 'auxiliary'
  | 'errors'
  | 'preview'
  | 'send'

/** Importações complementares (aba Opcionais), independentes do wizard de produtos. */
export type OptionalImportKind =
  | 'barcodes'
  | 'supplierRefs'
  | 'validity'
  | 'stock'
  | 'lots'

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
  checkId?: string
}

export interface ValidationCheckSummaryItem {
  id: string
  label: string
  count: number
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
  /** Resumo do que foi pesquisado (inclui zeros → “nenhum”). */
  checkSummary?: ValidationCheckSummaryItem[]
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

export interface AuxiliaryCsvPreview {
  fileId: string
  fileName: string
  columns: string[]
  rows: Record<string, string>[]
  totalRecords: number
  truncated: boolean
}

export interface ProductFieldCatalog {
  required: string[]
  optional: string[]
  farmaciaPopular: string[]
  controlados: string[]
  auxiliaryEntities: AuxiliaryEntity[]
  delimiter: string
  markupFormula: string
  tmsBaseUrl: string
  rules: {
    controladoSemDcb: string
    controladoSemRegistroMs?: string
    markupInconsistente: string
    aliquotaZeroStIsento?: string
    cfopAuto?: string
    aliquotaPercent?: string
    unidadeEstoque?: string
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

export type ProductSkipReason = 'codigo_barras' | 'codigo_migracao'

export interface SendJobSkippedProduct {
  index: number
  codigo: string
  nome: string
  codigobarras: string
  reason: ProductSkipReason
  message: string
  tmsProdutoId: number | null
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
  productSkipped?: number
  currentBatch: number
  totalBatches: number
  errors: SendJobError[]
  errorsTruncated: boolean
  skipped?: SendJobSkippedProduct[]
  skippedTruncated?: boolean
  startedAt: string | null
  finishedAt: string | null
  elapsedMs: number
  productsPerSecond: number
  percent: number
  remaining: number
  gruposTotal?: number
  gruposInserted?: number
  gruposFailed?: number
  auxTotal?: number
  auxInserted?: number
  auxFailed?: number
  auxSkipped?: number
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

export type ControladoSuggestKind = 'empty' | 'conflict' | 'confirm'

export interface ControladoSuggestion {
  rowIndex: number
  row: number
  ean: string
  codigo: string
  nome: string
  substance: string
  matchedName: string
  suggestedLista: string
  suggestedDcb: string
  suggestedDcbNome: string
  /** Registro MS from CMED — applied to registroms */
  registro: string
  currentLista: string
  currentDcb: string
  currentRegistro: string
  kind: ControladoSuggestKind
  tarja: string
  produtoCmed: string
  reason: string
}

export interface ControladoSuggestResult {
  available: boolean
  message?: string
  cmedSource?: string
  totalRows: number
  withEan: number
  foundInCmed: number
  controlledCandidates: number
  suggestions: ControladoSuggestion[]
}

/** @deprecated Prefer SendJobSnapshot */
export type TmsSendResult = Pick<
  SendJobSnapshot,
  'idFilial' | 'total' | 'successCount' | 'errorCount'
> & {
  errors: { index: number; codigo: string; message: string }[]
}
