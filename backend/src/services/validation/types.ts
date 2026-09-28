import { z } from 'zod'
import {
  AUXILIARY_ENTITIES,
  CONTROLADOS_HEADERS,
  FARMACIA_POPULAR_HEADERS,
  OPTIONAL_HEADERS,
  REQUIRED_HEADERS,
} from '../../schemas/product.schema.js'
import { UF_ICMS_TABLE } from '../../utils/icmsByUf.js'

export type IssueSeverity = 'error' | 'warning'

export interface ValidationIssue {
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

export interface ProductValidationResult {
  fileId: string
  fileName: string
  totalRecords: number
  errorCount: number
  warningCount: number
  missingRequiredHeaders: string[]
  unknownHeaders: string[]
  presentOptionalHeaders: string[]
  canProceed: boolean
  issues: ValidationIssue[]
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

export const MAX_ISSUES_PER_CHECK = 200
/** Limite alinhado ao body do envio (`max(50000)`). Antes era 5k e truncava o arquivo no envio. */
export const MAX_PREVIEW_ROWS = 50_000

export const SN_FIELDS = [
  'atualizaestoque',
  'atualizarpreco',
  'pagarpremicao',
  'permitedesconto',
  'st',
  'isento',
  'semincidencia',
  'usocontinuo',
  'medfciapop',
] as const

export const INTEGER_OPTIONAL_FIELDS = [
  'subgrupo',
  'categoria',
  'laboratorio',
  'grupodepreco',
  'similar',
  'dcb',
] as const

export const DECIMAL_OPTIONAL_FIELDS = [
  'valorpmc',
  'estoque',
  'estoqueminimo',
  'descontofixo',
  'comissao',
  'demanda',
  'descontomax',
  'qtdfciapop',
  'valorfciapop',
] as const

export const KNOWN_HEADERS = new Set<string>([
  ...REQUIRED_HEADERS,
  ...OPTIONAL_HEADERS,
  ...FARMACIA_POPULAR_HEADERS,
  ...CONTROLADOS_HEADERS,
])

/** Colunas antigas do modelo — aceitas no CSV mas ignoradas no envio. */
export const LEGACY_IGNORED_HEADERS = new Set(['unidade', 'field5'])

const brazilianUfSchema = z.enum(
  UF_ICMS_TABLE.map((e) => e.uf) as [string, ...string[]]
)

export const validateBodySchema = z.object({
  fileId: z.string().uuid(),
  delimiter: z.string().min(1).max(1).optional(),
  encoding: z.string().min(1).optional(),
  clientUf: brazilianUfSchema.optional(),
  auxiliary: z
    .record(z.enum(AUXILIARY_ENTITIES), z.string().uuid())
    .optional(),
})

export const validateRowsBodySchema = z.object({
  rows: z.array(z.record(z.string())).min(1),
  clientUf: brazilianUfSchema.optional(),
  auxiliary: z.record(z.enum(AUXILIARY_ENTITIES), z.string().uuid()).optional(),
})

export type ValidateProductInput = z.infer<typeof validateBodySchema>
export type ValidateRowsInput = z.infer<typeof validateRowsBodySchema>

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
