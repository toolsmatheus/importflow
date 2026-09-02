export interface ServerIdentification {
  idFilial: number
  versao: string
  raw: unknown
}

export interface TmsAuth {
  idFilial: number
  versao: string
  authorization: string
}

export interface BatchInsertResult {
  ok: boolean
  message?: string
  statusCode?: number
}

export interface ImportarListaProdutoError {
  codigoMigracao: string
  message: string
}

export interface ImportarListaProdutosResult extends BatchInsertResult {
  importedCount?: number
  failedCount?: number
  itemErrors?: ImportarListaProdutoError[]
}

export interface TmsDcbRecord {
  id: number | string
  dcb: string
  descricao: string
}

export type TmsAuxiliaryEntity =
  | 'grupo'
  | 'subgrupo'
  | 'categoria'
  | 'laboratorio'
  | 'grupodepreco'
  | 'similar'
  | 'dcb'

export type AuxiliaryMigracaoEntity =
  | 'grupo'
  | 'subgrupo'
  | 'categoria'
  | 'laboratorio'
  | 'grupodepreco'

export interface AuxiliaryExistenceCatalogs {
  /** codigo_migracao (string) → já existe no TMS */
  byMigracao: Record<AuxiliaryMigracaoEntity, Set<string>>
  /** Similar não tem codigo_migracao — deduplica por descrição UPPER */
  similarByDescricao: Set<string>
}

export interface ProductExistenceCatalogs {
  /** codigoBarras → id do produto TMS */
  byBarcode: Map<string, number>
  /** codigo_migracao → id do produto TMS */
  byMigracao: Map<string, number>
  /** id do produto → tipoclassesngpc (ex.: tcNenhuma) */
  tipoclassesngpcById: Map<number, string>
  /** id do produto → codigo_migracao (primeiro valor visto) */
  migracaoById: Map<number, string>
}

export interface InsertLoteMedicamentoInput {
  produtoId: number
  lote: string
  /** Grava em quantidadeInicial (quantidade corrente é mantida pelo ERP). */
  quantidade: number
  /** ISO yyyy-mm-dd */
  fabricacao: string
  /** ISO yyyy-mm-dd */
  validade: string
  idFilial: number
  /** Código MS string — resolvido para associação RegistroMS. */
  registroMs?: string
  /** Id já resolvido de RegistroMS (opcional). */
  registroMsId?: number
}

export interface ImportacaoEstoqueDto {
  /** EAN — layout código de barras (Delphi). */
  CodigoBarras?: string
  QuantidadeEstoque: number
  IsCodigoBarra: boolean
  IdFilial: number
  /** Quando não usa barras: id interno do produto. */
  IdProduto?: number
  /** codigo_migracao do produto (inteiro no DTO XData). */
  CodigoMigracao?: number
  /** Lote SNGPC / controlado. */
  Lote?: string
  /** ISO yyyy-mm-dd */
  Validade?: string
  /** ISO yyyy-mm-dd */
  Fabricacao?: string
  RegistroMS?: string
}

export type SalvarListaEstoquesOutcome =
  | 'imported'
  | 'skipped_controlled'
  | 'skipped_not_imported'
  | 'not_imported'
  | 'http_error'

export interface SalvarListaEstoquesResult extends BatchInsertResult {
  outcome?: SalvarListaEstoquesOutcome
  /** Linhas confirmadas em Importado. */
  imported?: number
}
