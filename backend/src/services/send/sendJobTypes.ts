import type {
  ProductExistenceCatalogs,
  ProductLookupCatalogs,
  TmsAuxiliaryEntity,
} from '../tmsService.js'

export type SendJobStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type SendMode = 'live' | 'simulate'

/** Fase atual do job — usada na UI de progresso. */
export type SendJobPhase = 'auxiliaries' | 'catalogs' | 'products' | 'done'

export type ProductSkipReason = 'codigo_barras' | 'codigo_migracao'

export interface SendJobError {
  index: number
  codigo: string
  message: string
  batch: number
}

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
  phase: SendJobPhase
  tmsBaseUrl: string
  idFilial: number
  batchSize: number
  concurrency: number
  total: number
  processed: number
  successCount: number
  errorCount: number
  productSkipped: number
  currentBatch: number
  totalBatches: number
  errors: SendJobError[]
  errorsTruncated: boolean
  skipped: SendJobSkippedProduct[]
  skippedTruncated: boolean
  startedAt: string | null
  finishedAt: string | null
  elapsedMs: number
  productsPerSecond: number
  percent: number
  remaining: number
  gruposTotal: number
  gruposInserted: number
  gruposFailed: number
  auxTotal: number
  auxInserted: number
  auxFailed: number
  auxSkipped: number
}

export interface AuxiliarySendRow {
  entity: TmsAuxiliaryEntity
  codigo: string
  descricao: string
}

export const AUX_LABEL: Record<TmsAuxiliaryEntity, string> = {
  grupo: 'Grupo',
  subgrupo: 'Subgrupo',
  categoria: 'Categoria',
  laboratorio: 'Laboratório',
  grupodepreco: 'Grupo de preço',
  similar: 'Similar',
  dcb: 'DCB',
}

export interface SendJobInternal {
  id: string
  status: SendJobStatus
  mode: SendMode
  phase: SendJobPhase
  tmsBaseUrl: string
  idFilial: number
  batchSize: number
  concurrency: number
  rows: Record<string, string>[]
  pendingIndexes: number[]
  failedIndexes: number[]
  successCount: number
  errorCount: number
  processed: number
  currentBatch: number
  totalBatches: number
  errors: SendJobError[]
  startedAt: number | null
  finishedAt: number | null
  pauseRequested: boolean
  cancelRequested: boolean
  runner: Promise<void> | null
  auxiliaries: AuxiliarySendRow[]
  auxInserted: number
  auxFailed: number
  auxSkipped: number
  auxDone: boolean
  productCatalogs: ProductLookupCatalogs | null
  productExistence: ProductExistenceCatalogs | null
  skipped: SendJobSkippedProduct[]
}

export interface PreparedProductSend {
  index: number
  codigo: string
  barcode: string
  additionalBarcodes: string[]
  payload: Record<string, unknown>
  warnings: string[]
}

export const MAX_STORED_ERRORS = 500
export const MAX_SNAPSHOT_SKIPPED = 200
export const JOB_TTL_MS = 6 * 60 * 60 * 1000
