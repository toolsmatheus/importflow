export type ControladoSuggestKind = 'empty' | 'conflict' | 'confirm'

export interface ControladoSuggestion {
  /** Índice 0-based na lista de rows enviada */
  rowIndex: number
  /** Número de linha CSV (header = 1) */
  row: number
  ean: string
  codigo: string
  nome: string
  substance: string
  matchedName: string
  suggestedLista: string
  suggestedDcb: string
  suggestedDcbNome: string
  /** Registro MS (CMED) — gravar em registroms ao aplicar */
  registro: string
  currentLista: string
  currentDcb: string
  currentRegistro: string
  kind: ControladoSuggestKind
  tarja: string
  produtoCmed: string
  reason: string
}
