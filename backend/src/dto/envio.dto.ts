import type {
  ErroEnvioJob,
  FaseEnvioJob,
  ModoEnvio,
  ProdutoIgnoradoEnvioJob,
  StatusEnvioJob,
} from '../models/envio.model.js'

/** Snapshot de progresso do job de envio de produtos (API). */
export interface SnapshotEnvioJobDto {
  id: string
  status: StatusEnvioJob
  mode: ModoEnvio
  phase: FaseEnvioJob
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
  errors: ErroEnvioJob[]
  errorsTruncated: boolean
  skipped: ProdutoIgnoradoEnvioJob[]
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

/** @deprecated Use SnapshotEnvioJobDto */
export type SnapshotEnvioJob = SnapshotEnvioJobDto
