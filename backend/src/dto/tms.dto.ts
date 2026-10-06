/**
 * DTO XData para SalvarListaEstoques (TMS) — contrato externo ToolsPharma.
 * Mantido em dto/ por ser formato de payload HTTP; usado só pelo layer tms/.
 */
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
