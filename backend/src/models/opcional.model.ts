/** Status compartilhado pelos jobs opcionais (fornecedor / validade / estoque / lotes). */
export type OptionalJobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type OptionalModoEnvio = 'live' | 'simulate'

/**
 * Tipos de importação complementar (Etapa 2) — ordem fixa do fluxo.
 * 1 barras · 2 fornecedor · 3 estoque · 4 lotes · 5 preço · 6 desconto · 7 validade
 */
export type OptionalImportKind =
  | 'barcodeExtras'
  | 'supplierRefs'
  | 'stock'
  | 'lots'
  | 'priceUpdate'
  | 'paymentDiscount'
  | 'validity'

export const OPTIONAL_IMPORT_KINDS: OptionalImportKind[] = [
  'barcodeExtras',
  'supplierRefs',
  'stock',
  'lots',
  'priceUpdate',
  'paymentDiscount',
  'validity',
]

/** Quais tipos já têm envio implementado. */
export const OPTIONAL_IMPORT_READY: Record<OptionalImportKind, boolean> = {
  barcodeExtras: true,
  supplierRefs: true,
  stock: true,
  lots: true,
  priceUpdate: false,
  paymentDiscount: false,
  validity: true,
}

export const OPTIONAL_IMPORT_READY_KINDS: OptionalImportKind[] =
  OPTIONAL_IMPORT_KINDS.filter((k) => OPTIONAL_IMPORT_READY[k])

/** Nomes aceitos (case-insensitive) por tipo de CSV opcional — primeiro = padrão. */
export const OPTIONAL_FILE_ALIASES: Record<OptionalImportKind, string[]> = {
  barcodeExtras: [
    'CodigosAdicionais.csv',
    'codigosadicionais.csv',
    'barras.csv',
    'barras-adicionais.csv',
    'modelo-barras-adicionais.csv',
    'codigoadicional.csv',
  ],
  supplierRefs: [
    'CodigoFornecedor.csv',
    'codigofornecedor.csv',
    'codigos-fornecedor.csv',
    'modelo-codigos-fornecedor.csv',
    'fornecedor.csv',
  ],
  stock: [
    'estoque.csv',
    'produtos.csv',
    'produto.csv',
    'modelo-estoque.csv',
  ],
  lots: ['lotes.csv', 'lotes-controlados.csv', 'modelo-lotes-controlados.csv'],
  priceUpdate: ['preco.csv', 'precos.csv', 'atualizacao-preco.csv'],
  paymentDiscount: [
    'desconto.csv',
    'descontos.csv',
    'desconto-condicao-pagamento.csv',
  ],
  validity: ['validade.csv', 'validade-produtos.csv', 'modelo-validade-produtos.csv'],
}

/** Sem teto: Etapa 2 exibe erros/alertas completos na verificação. */
export const MAX_STORED_OPTIONAL_ERRORS = Number.MAX_SAFE_INTEGER
export const MAX_STORED_OPTIONAL_SKIPPED = Number.MAX_SAFE_INTEGER

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

export type BarcodeExtraJobError = OpcionalJobErroBase
export type BarcodeExtraJobSkipped = OpcionalJobIgnoradoBase

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
