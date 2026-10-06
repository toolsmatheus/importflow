import type { IssueValidacao, ValidationCheckSummaryItem } from '../models/validacao.model.js'

/** Resposta de POST /api/products/validate e validate-rows. */
export interface ResultadoValidacaoProdutoDto {
  fileId: string
  fileName: string
  totalRecords: number
  errorCount: number
  warningCount: number
  missingRequiredHeaders: string[]
  unknownHeaders: string[]
  presentOptionalHeaders: string[]
  canProceed: boolean
  issues: IssueValidacao[]
  /** Resumo do que foi pesquisado/validado (inclui zeros). */
  checkSummary: ValidationCheckSummaryItem[]
  /** Contagem de atualizaestoque = S / N em todo o arquivo. */
  atualizaEstoqueSummary: { s: number; n: number }
  /**
   * Números de linha do CSV (com cabeçalho = linha 1) que têm erro.
   * Completo mesmo quando `issues` está truncado.
   */
  errorRows: number[]
  truncated: boolean
  columns: string[]
  rows: Record<string, string>[]
}

export interface ProductFieldCatalogDto {
  required: string[]
  optional: string[]
  farmaciaPopular: string[]
  controlados: string[]
  auxiliaryEntities: string[]
  delimiter: string
  markupFormula: string
  tmsBaseUrl: string
  rules: Record<string, string>
}
