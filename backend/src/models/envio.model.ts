import type { AuxiliaryEntity } from './produto.model.js'
import type { CatalogosBuscaProduto } from './produto-tms.model.js'
import type { ProductExistenceCatalogs } from './tms.model.js'

export type StatusEnvioJob =
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type ModoEnvio = 'live' | 'simulate'

/** Fase atual do job — usada na UI de progresso. */
export type FaseEnvioJob = 'auxiliaries' | 'catalogs' | 'products' | 'done'

export type ProductSkipReason = 'codigo_barras' | 'codigo_migracao'

export interface ErroEnvioJob {
  index: number
  codigo: string
  message: string
  batch: number
}

export interface ProdutoIgnoradoEnvioJob {
  index: number
  codigo: string
  nome: string
  codigobarras: string
  reason: ProductSkipReason
  message: string
  tmsProdutoId: number | null
}

export interface LinhaEnvioAuxiliar {
  entity: AuxiliaryEntity
  codigo: string
  descricao: string
}

export const AUX_LABEL: Record<AuxiliaryEntity, string> = {
  grupo: 'Grupo',
  subgrupo: 'Subgrupo',
  categoria: 'Categoria',
  laboratorio: 'Laboratório',
  grupodepreco: 'Grupo de preço',
  similar: 'Similar',
  dcb: 'DCB',
}

/** Estado interno do job (não trafega na API). */
export interface EnvioJobInterno {
  id: string
  status: StatusEnvioJob
  mode: ModoEnvio
  phase: FaseEnvioJob
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
  errors: ErroEnvioJob[]
  startedAt: number | null
  finishedAt: number | null
  pauseRequested: boolean
  cancelRequested: boolean
  runner: Promise<void> | null
  auxiliaries: LinhaEnvioAuxiliar[]
  auxInserted: number
  auxFailed: number
  auxSkipped: number
  auxDone: boolean
  productCatalogs: CatalogosBuscaProduto | null
  productExistence: ProductExistenceCatalogs | null
  skipped: ProdutoIgnoradoEnvioJob[]
}

export interface ProdutoEnvioPreparado {
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
