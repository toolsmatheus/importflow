import {
  CONTROLADOS_HEADERS,
  FARMACIA_POPULAR_HEADERS,
  OPTIONAL_HEADERS,
  REQUIRED_HEADERS,
} from './produto.model.js'

export {
  SN_FIELDS,
  INTEGER_OPTIONAL_FIELDS,
  DECIMAL_OPTIONAL_FIELDS,
} from './produto.model.js'

export type IssueSeverity = 'error' | 'warning'

export interface IssueValidacao {
  row: number
  field: string
  value: string
  message: string
  severity: IssueSeverity
  /** Categoria da checagem (ex.: markup_auto, invalid_format). */
  checkId?: string
}

/** Checagem nomeada — sempre listada, mesmo com count 0 (“nenhum”). */
export interface ValidationCheckSummaryItem {
  id: string
  label: string
  count: number
  severity: IssueSeverity
}

export const MAX_ISSUES_PER_CHECK = 200
/** Limite alinhado ao body do envio (`max(50000)`). Antes era 5k e truncava o arquivo no envio. */
export const MAX_PREVIEW_ROWS = 50_000

export const KNOWN_HEADERS = new Set<string>([
  ...REQUIRED_HEADERS,
  ...OPTIONAL_HEADERS,
  ...FARMACIA_POPULAR_HEADERS,
  ...CONTROLADOS_HEADERS,
])

/** Colunas antigas do modelo — aceitas no CSV mas ignoradas no envio. */
export const LEGACY_IGNORED_HEADERS = new Set(['unidade', 'field5'])

export type IssueCounters = {
  errors: number
  warnings: number
  total: number
  categories: Map<string, number>
  /** Quantos detalhes foram guardados por checagem (para lista expansível). */
  storedPerCheck: Map<string, number>
  /** Linhas (nº no CSV, com cabeçalho) que têm ao menos um erro — completo mesmo se issues truncadas. */
  errorRows: Set<number>
}

export function cell(record: Record<string, string>, field: string): string {
  return record[field] ?? ''
}

export function hasColumn(columns: Set<string>, field: string): boolean {
  return columns.has(field)
}
