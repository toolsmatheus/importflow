/** Status compartilhado pelos jobs opcionais (fornecedor / validade / estoque / lotes). */
export type OptionalJobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type OptionalModoEnvio = 'live' | 'simulate'

export const MAX_STORED_OPTIONAL_ERRORS = 200
export const MAX_STORED_OPTIONAL_SKIPPED = 200

export interface OptionalJobInternal<TError, TSkipped> {
  id: string
  status: OptionalJobStatus
  mode: OptionalModoEnvio
  tmsBaseUrl: string
  idFilial: number
  rows: Record<string, string>[]
  processed: number
  successCount: number
  errorCount: number
  skippedCount: number
  errors: TError[]
  skipped: TSkipped[]
  cancelRequested: boolean
  startedAt: number | null
  finishedAt: number | null
  runPromise?: Promise<void>
}

export interface OpcionalJobErroBase {
  index: number
  codigo: string
  message: string
}

export interface OpcionalJobIgnoradoBase {
  index: number
  codigo: string
  message: string
}

export type StockJobError = OpcionalJobErroBase
export type StockJobSkipped = OpcionalJobIgnoradoBase

export type LotJobError = OpcionalJobErroBase
export type LotJobSkipped = OpcionalJobIgnoradoBase

export type ValidityJobError = OpcionalJobErroBase
export type ValidityJobSkipped = OpcionalJobIgnoradoBase

export interface SupplierJobError {
  index: number
  codigo: string
  codigofornecedor: string
  message: string
}

export interface SupplierJobSkipped {
  index: number
  codigo: string
  codigofornecedor: string
  message: string
}
