import { z } from 'zod'
import {
  AUXILIARY_ENTITIES,
  CONTROLADOS_HEADERS,
  FARMACIA_POPULAR_HEADERS,
  LISTA_PIS_COFINS,
  OPTIONAL_HEADERS,
  REQUIRED_HEADERS,
  TEMPLATE_DELIMITER,
  type AuxiliaryEntity,
} from '../schemas/product.schema.js'
import {
  isBlank,
  isValidCfop,
  isValidEanCheckDigit,
  isValidIntegerId,
  isValidMigrationCode,
  isValidNcm,
  isValidProductName,
  parseBrazilianNumber,
} from '../utils/productFormats.js'
import {
  aliquotaMatchesUf,
  formatAliquotaCsv,
  getUfIcms,
  UF_ICMS_TABLE,
} from '../utils/icmsByUf.js'
import {
  FIELD_TO_AUXILIARY,
  loadAuxiliaryCatalog,
  type AuxiliaryCatalogs,
} from './auxiliaryService.js'
import { getStoredFile, type StoredCsvFile } from './csvFileService.js'
import { createRecordStream, normalizeRecord, resolveCsvOptions } from './csvService.js'
import { padDcbCode } from './dcbIndexService.js'
import { fetchTmsDcbCatalog, type TmsDcbRecord } from './tmsService.js'

export type IssueSeverity = 'error' | 'warning'

export interface ValidationIssue {
  row: number
  field: string
  value: string
  message: string
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
  truncated: boolean
  columns: string[]
  rows: Record<string, string>[]
}

const MAX_ISSUES = 1000
const MAX_PREVIEW_ROWS = 5000

const SN_FIELDS = [
  'atualizaestoque',
  'st',
  'isento',
  'semincidencia',
  'permitedesconto',
  'usocontinuo',
  'medfciapop',
] as const

const INTEGER_OPTIONAL_FIELDS = [
  'subgrupo',
  'categoria',
  'laboratorio',
  'grupodepreco',
  'similar',
  'dcb',
] as const

const DECIMAL_OPTIONAL_FIELDS = [
  'valorpmc',
  'estoque',
  'descontofixo',
  'comissao',
  'demanda',
  'descontomax',
  'qtdfciapop',
  'valorfciapop',
] as const

const KNOWN_HEADERS = new Set<string>([
  ...REQUIRED_HEADERS,
  ...OPTIONAL_HEADERS,
  ...FARMACIA_POPULAR_HEADERS,
  ...CONTROLADOS_HEADERS,
])

/** Colunas antigas do modelo — aceitas no CSV mas ignoradas no envio. */
const LEGACY_IGNORED_HEADERS = new Set(['unidade', 'field5'])

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

function pushIssue(
  issues: ValidationIssue[],
  counters: { errors: number; warnings: number; total: number },
  issue: ValidationIssue
) {
  counters.total++
  if (issue.severity === 'error') counters.errors++
  else counters.warnings++
  if (issues.length < MAX_ISSUES) issues.push(issue)
}

function cell(record: Record<string, string>, field: string): string {
  return record[field] ?? ''
}

function hasColumn(columns: Set<string>, field: string): boolean {
  return columns.has(field)
}

async function resolveAuxiliaryCatalogs(
  auxiliary?: Partial<Record<AuxiliaryEntity, string>>
): Promise<{ catalogs: AuxiliaryCatalogs; loadIssues: ValidationIssue[] }> {
  const catalogs: AuxiliaryCatalogs = {}
  const loadIssues: ValidationIssue[] = []

  if (!auxiliary) return { catalogs, loadIssues }

  for (const [entity, fileId] of Object.entries(auxiliary) as [AuxiliaryEntity, string][]) {
    const file = getStoredFile(fileId)
    if (!file) {
      loadIssues.push({
        row: 0,
        field: entity,
        value: '',
        message: `Arquivo auxiliar de ${entity} não encontrado. Envie novamente.`,
        severity: 'error',
      })
      continue
    }

    const { catalog, issues } = await loadAuxiliaryCatalog(file)
    catalogs[entity] = catalog

    for (const message of issues) {
      loadIssues.push({
        row: 0,
        field: entity,
        value: '',
        message,
        severity: 'warning',
      })
    }
  }

  return { catalogs, loadIssues }
}

/** Códigos Anvisa da base validada (controlados.txt) existem na tabela DCB do TMS, não no CSV auxiliar. */
function dcbExistsInTms(value: string, tmsDcb: Map<string, TmsDcbRecord> | null): boolean {
  if (!tmsDcb || tmsDcb.size === 0) return false
  const padded = padDcbCode(value)
  if (tmsDcb.has(padded) || tmsDcb.has(value)) return true
  const asNumber = String(Number(value))
  return asNumber !== 'NaN' && tmsDcb.has(asNumber)
}

async function loadTmsDcbForValidation(): Promise<Map<string, TmsDcbRecord> | null> {
  try {
    return await fetchTmsDcbCatalog()
  } catch {
    return null
  }
}

function validateAuxiliaryRefs(
  record: Record<string, string>,
  rowNumber: number,
  columns: Set<string>,
  catalogs: AuxiliaryCatalogs,
  issues: ValidationIssue[],
  counters: { errors: number; warnings: number; total: number },
  tmsDcb: Map<string, TmsDcbRecord> | null = null
) {
  for (const [field, entity] of Object.entries(FIELD_TO_AUXILIARY)) {
    if (!hasColumn(columns, field) && field !== 'codigogrupo') continue

    const value = cell(record, field).trim()
    if (isBlank(value)) {
      if (field === 'codigogrupo') {
        // já coberto pelo obrigatório
      }
      continue
    }

    if (!isValidIntegerId(value)) continue

    const catalog = catalogs[entity]

    // DCB da base validada = código Anvisa → resolve na tabela DCB do TMS.
    if (field === 'dcb') {
      if (catalog?.has(value) || catalog?.has(String(Number(value)))) continue
      if (dcbExistsInTms(value, tmsDcb)) continue
      if (catalog) {
        pushIssue(issues, counters, {
          row: rowNumber,
          field,
          value,
          message: tmsDcb
            ? `dcb "${value}" não encontrado no arquivo auxiliar nem na tabela DCB do banco.`
            : `dcb "${value}" não encontrado no arquivo auxiliar.`,
          severity: 'error',
        })
      } else if (!tmsDcb) {
        pushIssue(issues, counters, {
          row: rowNumber,
          field,
          value,
          message: `Arquivo auxiliar de dcb não enviado e banco indisponível — não foi possível validar o id ${value}.`,
          severity: 'error',
        })
      } else {
        pushIssue(issues, counters, {
          row: rowNumber,
          field,
          value,
          message: `dcb "${value}" não encontrado na tabela DCB do banco.`,
          severity: 'error',
        })
      }
      continue
    }

    if (!catalog) {
      if (field === 'codigogrupo' || !isBlank(value)) {
        pushIssue(issues, counters, {
          row: rowNumber,
          field,
          value,
          message: `Arquivo auxiliar de ${entity} não enviado — não foi possível validar o id ${value}.`,
          severity: 'error',
        })
      }
      continue
    }

    if (!catalog.has(value)) {
      pushIssue(issues, counters, {
        row: rowNumber,
        field,
        value,
        message: `${entity} "${value}" não encontrado no arquivo auxiliar.`,
        severity: 'error',
      })
    }
  }
}

function validateRow(
  record: Record<string, string>,
  rowNumber: number,
  columns: Set<string>,
  catalogs: AuxiliaryCatalogs,
  issues: ValidationIssue[],
  counters: { errors: number; warnings: number; total: number },
  tmsDcb: Map<string, TmsDcbRecord> | null = null,
  clientUf?: string
) {
  for (const field of REQUIRED_HEADERS) {
    if (!hasColumn(columns, field)) continue
    const value = cell(record, field)
    if (isBlank(value)) {
      pushIssue(issues, counters, {
        row: rowNumber,
        field,
        value: '',
        message: 'Campo obrigatório não informado.',
        severity: 'error',
      })
    }
  }

  const codigo = cell(record, 'codigo').trim()
  if (codigo && !isValidMigrationCode(codigo)) {
    pushIssue(issues, counters, {
      row: rowNumber,
      field: 'codigo',
      value: codigo,
      message: 'O código não pode conter letras — use apenas dígitos.',
      severity: 'error',
    })
  }

  const nome = cell(record, 'nome').trim()
  if (nome && !isValidProductName(nome)) {
    pushIssue(issues, counters, {
      row: rowNumber,
      field: 'nome',
      value: nome,
      message: 'O nome não pode ser vazio nem conter somente números.',
      severity: 'error',
    })
  }

  const grupo = cell(record, 'codigogrupo').trim()
  if (grupo && !isValidIntegerId(grupo)) {
    pushIssue(issues, counters, {
      row: rowNumber,
      field: 'codigogrupo',
      value: grupo,
      message: 'Deve ser um número inteiro (id do grupo no arquivo auxiliar).',
      severity: 'error',
    })
  }

  const custoRaw = cell(record, 'custo')
  const markupRaw = cell(record, 'markup')
  const vendaRaw = cell(record, 'venda')
  const fatorRaw = cell(record, 'fator')
  const aliquotaRaw = cell(record, 'aliquota')

  const custo = !isBlank(custoRaw) ? parseBrazilianNumber(custoRaw) : null
  const markup = !isBlank(markupRaw) ? parseBrazilianNumber(markupRaw) : null
  const venda = !isBlank(vendaRaw) ? parseBrazilianNumber(vendaRaw) : null

  if (!isBlank(custoRaw) && custo === null) {
    pushIssue(issues, counters, {
      row: rowNumber,
      field: 'custo',
      value: custoRaw,
      message: 'Valor numérico inválido.',
      severity: 'error',
    })
  }
  if (!isBlank(markupRaw) && markup === null) {
    pushIssue(issues, counters, {
      row: rowNumber,
      field: 'markup',
      value: markupRaw,
      message: 'Valor numérico inválido.',
      severity: 'error',
    })
  }
  if (!isBlank(vendaRaw) && venda === null) {
    pushIssue(issues, counters, {
      row: rowNumber,
      field: 'venda',
      value: vendaRaw,
      message: 'Valor numérico inválido.',
      severity: 'error',
    })
  }
  if (!isBlank(fatorRaw) && parseBrazilianNumber(fatorRaw) === null) {
    pushIssue(issues, counters, {
      row: rowNumber,
      field: 'fator',
      value: fatorRaw,
      message: 'Valor numérico inválido.',
      severity: 'error',
    })
  }
  if (!isBlank(aliquotaRaw) && parseBrazilianNumber(aliquotaRaw) === null) {
    pushIssue(issues, counters, {
      row: rowNumber,
      field: 'aliquota',
      value: aliquotaRaw,
      message: 'Valor numérico inválido.',
      severity: 'error',
    })
  }

  const aliquotaNum = !isBlank(aliquotaRaw) ? parseBrazilianNumber(aliquotaRaw) : null
  if (aliquotaNum === 0) {
    const st = hasColumn(columns, 'st')
      ? cell(record, 'st').trim().toUpperCase()
      : ''
    const isento = hasColumn(columns, 'isento')
      ? cell(record, 'isento').trim().toUpperCase()
      : ''
    const stOn = st === 'S'
    const isentoOn = isento === 'S'
    if (stOn === isentoOn) {
      pushIssue(issues, counters, {
        row: rowNumber,
        field: 'aliquota',
        value: aliquotaRaw,
        message:
          'Quando aliquota=0, exatamente uma coluna deve ser S: st (substituição) ou isento.',
        severity: 'error',
      })
    }
  } else if (
    aliquotaNum !== null &&
    aliquotaNum > 0 &&
    clientUf &&
    !aliquotaMatchesUf(aliquotaNum, clientUf)
  ) {
    const entry = getUfIcms(clientUf)
    const expected = entry ? formatAliquotaCsv(entry.aliquota) : '?'
    pushIssue(issues, counters, {
      row: rowNumber,
      field: 'aliquota',
      value: aliquotaRaw,
      message: `Alíquota diferente da padrão da UF ${clientUf} (esperada ${expected}%).`,
      severity: 'warning',
    })
  }

  const lista = cell(record, 'listapiscofins').trim().toUpperCase()
  if (lista && !(LISTA_PIS_COFINS as readonly string[]).includes(lista)) {
    pushIssue(issues, counters, {
      row: rowNumber,
      field: 'listapiscofins',
      value: cell(record, 'listapiscofins'),
      message: `Valor inválido. Opções: ${LISTA_PIS_COFINS.join(', ')}.`,
      severity: 'error',
    })
  }

  const cfop = cell(record, 'cfop').trim()
  if (cfop && !isValidCfop(cfop)) {
    pushIssue(issues, counters, {
      row: rowNumber,
      field: 'cfop',
      value: cfop,
      message: 'CFOP deve ter exatamente 4 dígitos numéricos.',
      severity: 'error',
    })
  }

  const ncm = cell(record, 'ncm').trim()
  if (ncm && !isValidNcm(ncm)) {
    pushIssue(issues, counters, {
      row: rowNumber,
      field: 'ncm',
      value: ncm,
      message: 'NCM deve ter exatamente 8 dígitos numéricos.',
      severity: 'error',
    })
  }

  if (hasColumn(columns, 'codigobarras')) {
    const ean = cell(record, 'codigobarras').trim()
    if (!isBlank(ean) && !isValidEanCheckDigit(ean)) {
      pushIssue(issues, counters, {
        row: rowNumber,
        field: 'codigobarras',
        value: ean,
        message: 'Código de barras inválido (dígito verificador EAN não confere).',
        severity: 'error',
      })
    }
  }

  for (const field of INTEGER_OPTIONAL_FIELDS) {
    if (!hasColumn(columns, field)) continue
    const value = cell(record, field).trim()
    if (isBlank(value)) continue
    if (!isValidIntegerId(value)) {
      pushIssue(issues, counters, {
        row: rowNumber,
        field,
        value,
        message: 'Deve ser um número inteiro (id no arquivo auxiliar).',
        severity: 'error',
      })
    }
  }

  for (const field of DECIMAL_OPTIONAL_FIELDS) {
    if (!hasColumn(columns, field)) continue
    const value = cell(record, field)
    if (isBlank(value)) continue
    if (parseBrazilianNumber(value) === null) {
      pushIssue(issues, counters, {
        row: rowNumber,
        field,
        value,
        message: 'Valor numérico inválido.',
        severity: 'error',
      })
    }
  }

  for (const field of SN_FIELDS) {
    if (!hasColumn(columns, field)) continue
    const value = cell(record, field).trim().toUpperCase()
    if (isBlank(value)) continue
    if (value !== 'S' && value !== 'N') {
      pushIssue(issues, counters, {
        row: rowNumber,
        field,
        value: cell(record, field),
        message: 'Valor deve ser S ou N.',
        severity: 'error',
      })
    }
  }

  if (hasColumn(columns, 'ativo')) {
    const ativo = cell(record, 'ativo').trim().toUpperCase()
    if (!isBlank(ativo) && ativo !== 'A' && ativo !== 'I') {
      pushIssue(issues, counters, {
        row: rowNumber,
        field: 'ativo',
        value: cell(record, 'ativo'),
        message: 'Valor deve ser A (ativo) ou I (inativo).',
        severity: 'error',
      })
    }
  }

  if (hasColumn(columns, 'st') && cell(record, 'st').trim().toUpperCase() === 'S') {
    const isentoOn =
      hasColumn(columns, 'isento') && cell(record, 'isento').trim().toUpperCase() === 'S'
    if (isentoOn) {
      pushIssue(issues, counters, {
        row: rowNumber,
        field: 'st',
        value: 'S',
        message: 'st e isento não podem ser S ao mesmo tempo.',
        severity: 'error',
      })
    }
  }

  if (hasColumn(columns, 'descontofixo') && hasColumn(columns, 'descontomax')) {
    const fixo = parseBrazilianNumber(cell(record, 'descontofixo'))
    const max = parseBrazilianNumber(cell(record, 'descontomax'))
    if (fixo !== null && max !== null && fixo > max) {
      pushIssue(issues, counters, {
        row: rowNumber,
        field: 'descontofixo',
        value: cell(record, 'descontofixo'),
        message: `Desconto fixo (${fixo}) é maior que o desconto máximo (${max}).`,
        severity: 'warning',
      })
    }
  }

  if (hasColumn(columns, 'medfciapop') && cell(record, 'medfciapop').trim().toUpperCase() === 'S') {
    for (const field of ['qtdfciapop', 'valorfciapop'] as const) {
      if (isBlank(cell(record, field))) {
        pushIssue(issues, counters, {
          row: rowNumber,
          field,
          value: '',
          message: 'Obrigatório quando medfciapop = S.',
          severity: 'error',
        })
      }
    }
  }

  if (hasColumn(columns, 'listacontrole')) {
    const listaControle = cell(record, 'listacontrole').trim()
    if (!isBlank(listaControle)) {
      const dcb = cell(record, 'dcb').trim()
      if (isBlank(dcb)) {
        pushIssue(issues, counters, {
          row: rowNumber,
          field: 'dcb',
          value: '',
          message: 'DCB é obrigatório quando o produto é controlado (listacontrole preenchida).',
          severity: 'error',
        })
      } else if (!isValidIntegerId(dcb)) {
        pushIssue(issues, counters, {
          row: rowNumber,
          field: 'dcb',
          value: dcb,
          message: 'DCB deve ser um número inteiro (código Anvisa ou id do auxiliar).',
          severity: 'error',
        })
      }

      const registroms = hasColumn(columns, 'registroms')
        ? cell(record, 'registroms').trim()
        : ''
      if (isBlank(registroms)) {
        pushIssue(issues, counters, {
          row: rowNumber,
          field: 'registroms',
          value: '',
          message:
            'Registro MS é obrigatório quando o produto é controlado (listacontrole preenchida).',
          severity: 'error',
        })
      }
    }
  }

  validateAuxiliaryRefs(record, rowNumber, columns, catalogs, issues, counters, tmsDcb)
}

function finalizeResult(
  base: Omit<ProductValidationResult, 'errorCount' | 'warningCount' | 'canProceed' | 'truncated'> & {
    counters: { errors: number; warnings: number; total: number }
  }
): ProductValidationResult {
  return {
    fileId: base.fileId,
    fileName: base.fileName,
    totalRecords: base.totalRecords,
    errorCount: base.counters.errors,
    warningCount: base.counters.warnings,
    missingRequiredHeaders: base.missingRequiredHeaders,
    unknownHeaders: base.unknownHeaders,
    presentOptionalHeaders: base.presentOptionalHeaders,
    canProceed: base.counters.errors === 0,
    issues: base.issues,
    truncated: base.counters.total > base.issues.length,
    columns: base.columns,
    rows: base.rows,
  }
}

export async function validateProductCsv(
  file: StoredCsvFile,
  input: ValidateProductInput
): Promise<ProductValidationResult> {
  const { catalogs, loadIssues } = await resolveAuxiliaryCatalogs(input.auxiliary)
  const tmsDcb = await loadTmsDcbForValidation()

  const options = await resolveCsvOptions(file.filePath, {
    delimiter: input.delimiter ?? TEMPLATE_DELIMITER,
    encoding: input.encoding,
    hasHeader: true,
  })

  const issues: ValidationIssue[] = [...loadIssues]
  const counters = {
    errors: loadIssues.filter((i) => i.severity === 'error').length,
    warnings: loadIssues.filter((i) => i.severity === 'warning').length,
    total: loadIssues.length,
  }

  let columns: string[] = []
  let totalRecords = 0
  const seenCodes = new Map<string, number>()
  let headersChecked = false
  let missingRequiredHeaders: string[] = []
  let unknownHeaders: string[] = []
  let presentOptionalHeaders: string[] = []
  const rows: Record<string, string>[] = []

  if (!catalogs.grupo) {
    pushIssue(issues, counters, {
      row: 0,
      field: 'grupo',
      value: '',
      message: 'Envie o arquivo auxiliar grupo.csv (obrigatório — coluna codigogrupo).',
      severity: 'error',
    })
  }

  const stream = createRecordStream(file.filePath, { ...options, hasHeader: true })
  let columnSet = new Set<string>()

  for await (const raw of stream) {
    const record = normalizeRecord(raw as Record<string, string> | string[])

    if (!headersChecked) {
      columns = Object.keys(record)
      columnSet = new Set(columns)
      missingRequiredHeaders = REQUIRED_HEADERS.filter((h) => !columnSet.has(h))
      unknownHeaders = columns.filter(
        (h) => !KNOWN_HEADERS.has(h) && !LEGACY_IGNORED_HEADERS.has(h)
      )
      presentOptionalHeaders = [
        ...OPTIONAL_HEADERS,
        ...FARMACIA_POPULAR_HEADERS,
        ...CONTROLADOS_HEADERS,
      ].filter((h) => columnSet.has(h))

      for (const header of missingRequiredHeaders) {
        pushIssue(issues, counters, {
          row: 1,
          field: header,
          value: '',
          message: 'Coluna obrigatória ausente no cabeçalho do CSV.',
          severity: 'error',
        })
      }

      for (const header of unknownHeaders) {
        pushIssue(issues, counters, {
          row: 1,
          field: header,
          value: '',
          message: 'Coluna não reconhecida pelo modelo — será ignorada na importação.',
          severity: 'warning',
        })
      }

      headersChecked = true
    }

    totalRecords++
    const rowNumber = totalRecords + 1

    if (rows.length < MAX_PREVIEW_ROWS) {
      rows.push({ ...record })
    }

    if (missingRequiredHeaders.length === 0) {
      validateRow(
        record,
        rowNumber,
        columnSet,
        catalogs,
        issues,
        counters,
        tmsDcb,
        input.clientUf
      )
    }

    const codigo = cell(record, 'codigo').trim()
    if (codigo && isValidMigrationCode(codigo)) {
      const firstRow = seenCodes.get(codigo)
      if (firstRow !== undefined) {
        pushIssue(issues, counters, {
          row: rowNumber,
          field: 'codigo',
          value: codigo,
          message: `Código duplicado no arquivo (já apareceu na linha ${firstRow}).`,
          severity: 'error',
        })
      } else {
        seenCodes.set(codigo, rowNumber)
      }
    }
  }

  if (totalRecords === 0 && missingRequiredHeaders.length === 0) {
    pushIssue(issues, counters, {
      row: 1,
      field: '',
      value: '',
      message: 'O arquivo não contém nenhum registro de produto.',
      severity: 'error',
    })
  }

  return finalizeResult({
    fileId: file.id,
    fileName: file.fileName,
    totalRecords,
    missingRequiredHeaders,
    unknownHeaders,
    presentOptionalHeaders,
    issues,
    columns,
    rows,
    counters,
  })
}

/** Revalida linhas já editadas na prévia (sem reler o CSV do disco). */
export async function validateProductRows(
  input: ValidateRowsInput
): Promise<ProductValidationResult> {
  const { catalogs, loadIssues } = await resolveAuxiliaryCatalogs(input.auxiliary)
  const tmsDcb = await loadTmsDcbForValidation()

  const issues: ValidationIssue[] = [...loadIssues]
  const counters = {
    errors: loadIssues.filter((i) => i.severity === 'error').length,
    warnings: loadIssues.filter((i) => i.severity === 'warning').length,
    total: loadIssues.length,
  }

  if (!catalogs.grupo) {
    pushIssue(issues, counters, {
      row: 0,
      field: 'grupo',
      value: '',
      message: 'Envie o arquivo auxiliar grupo.csv (obrigatório).',
      severity: 'error',
    })
  }

  const columns = input.rows[0] ? Object.keys(input.rows[0]) : [...REQUIRED_HEADERS]
  const columnSet = new Set(columns)
  const seenCodes = new Map<string, number>()
  const rows = input.rows.map((row) => ({ ...row }))

  rows.forEach((record, index) => {
    const rowNumber = index + 2
    validateRow(
      record,
      rowNumber,
      columnSet,
      catalogs,
      issues,
      counters,
      tmsDcb,
      input.clientUf
    )

    const codigo = cell(record, 'codigo').trim()
    if (codigo && isValidMigrationCode(codigo)) {
      const firstRow = seenCodes.get(codigo)
      if (firstRow !== undefined) {
        pushIssue(issues, counters, {
          row: rowNumber,
          field: 'codigo',
          value: codigo,
          message: `Código duplicado (já aparece na linha ${firstRow}).`,
          severity: 'error',
        })
      } else {
        seenCodes.set(codigo, rowNumber)
      }
    }
  })

  return finalizeResult({
    fileId: '',
    fileName: 'preview',
    totalRecords: rows.length,
    missingRequiredHeaders: REQUIRED_HEADERS.filter((h) => !columnSet.has(h)),
    unknownHeaders: [],
    presentOptionalHeaders: [
      ...OPTIONAL_HEADERS,
      ...FARMACIA_POPULAR_HEADERS,
      ...CONTROLADOS_HEADERS,
    ].filter((h) => columnSet.has(h)),
    issues,
    columns,
    rows,
    counters,
  })
}
