import type {
  OptionalImportKind,
  OptionalJobStatus,
  OptionalModoEnvio,
  LotJobError,
  LotJobSkipped,
  StockJobError,
  StockJobSkipped,
  SupplierJobError,
  SupplierJobSkipped,
  ValidityJobError,
  ValidityJobSkipped,
} from '../models/opcional.model.js'

export interface OptionalCollectedFileDto {
  kind: OptionalImportKind
  fileName: string
  /** Conteúdo UTF-8 do CSV (para o cliente montar File e enviar). */
  content: string
}

export interface OptionalFolderCollectResultDto {
  folderPath: string
  found: { kind: OptionalImportKind; fileName: string }[]
  missing: string[]
  files: OptionalCollectedFileDto[]
}

export interface OptionalJobSnapshotDto<TError, TSkipped> {
  id: string
  status: OptionalJobStatus
  mode: OptionalModoEnvio
  tmsBaseUrl: string
  idFilial: number
  total: number
  processed: number
  successCount: number
  errorCount: number
  skippedCount: number
  percent: number
  errors: TError[]
  errorsTruncated: boolean
  skipped: TSkipped[]
  skippedTruncated: boolean
  startedAt: string | null
  finishedAt: string | null
  message?: string
}

/** Alias interno / compat — mesmo formato da API. */
export type OptionalJobSnapshot<TError, TSkipped> = OptionalJobSnapshotDto<TError, TSkipped>

export type StockJobSnapshotDto = OptionalJobSnapshotDto<StockJobError, StockJobSkipped>
export type LotJobSnapshotDto = OptionalJobSnapshotDto<LotJobError, LotJobSkipped>
export type ValidityJobSnapshotDto = OptionalJobSnapshotDto<
  ValidityJobError,
  ValidityJobSkipped
>
export type SupplierJobSnapshotDto = OptionalJobSnapshotDto<
  SupplierJobError,
  SupplierJobSkipped
>
