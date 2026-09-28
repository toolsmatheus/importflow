import {
  CONTROLADOS_HEADERS,
  FARMACIA_POPULAR_HEADERS,
  OPTIONAL_HEADERS,
  REQUIRED_HEADERS,
  TEMPLATE_DELIMITER,
} from '../schemas/product.schema.js'
import { isValidMigrationCode } from '../utils/productFormats.js'
import { type StoredCsvFile } from './csvFileService.js'
import { createRecordStream, normalizeRecord, resolveCsvOptions } from './csvService.js'
import { resolveAuxiliaryCatalogs } from './validation/auxiliaryValidation.js'
import { buildCheckSummary, classifyIssue } from './validation/checkSummary.js'
import { loadTmsDcbForValidation } from './validation/controladoValidation.js'
import {
  createCounters,
  isIssueListTruncated,
  pushIssue,
} from './validation/counters.js'
import { validateRow } from './validation/rowValidation.js'
import {
  cell,
  KNOWN_HEADERS,
  LEGACY_IGNORED_HEADERS,
  MAX_PREVIEW_ROWS,
  type IssueCounters,
  type ProductValidationResult,
  type ValidateProductInput,
  type ValidateRowsInput,
  type ValidationIssue,
} from './validation/types.js'

export type {
  IssueSeverity,
  ProductValidationResult,
  ValidateProductInput,
  ValidateRowsInput,
  ValidationCheckSummaryItem,
  ValidationIssue,
} from './validation/types.js'

export {
  validateBodySchema,
  validateRowsBodySchema,
} from './validation/types.js'

function countAtualizaEstoqueFlags(rows: Iterable<Record<string, string>>): {
  s: number
  n: number
} {
  let s = 0
  let n = 0
  for (const row of rows) {
    const v = String(row.atualizaestoque ?? '').trim().toUpperCase()
    if (v === 'S') s++
    else if (v === 'N') n++
  }
  return { s, n }
}

function finalizeResult(
  base: Omit<
    ProductValidationResult,
    | 'errorCount'
    | 'warningCount'
    | 'canProceed'
    | 'truncated'
    | 'checkSummary'
    | 'atualizaEstoqueSummary'
    | 'errorRows'
  > & {
    counters: IssueCounters
    atualizaEstoqueSummary?: { s: number; n: number }
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
    checkSummary: buildCheckSummary(base.counters.categories),
    atualizaEstoqueSummary: base.atualizaEstoqueSummary ?? { s: 0, n: 0 },
    errorRows: [...base.counters.errorRows].sort((a, b) => a - b),
    truncated: isIssueListTruncated(base.counters),
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

  const issues: ValidationIssue[] = loadIssues.map((issue) => ({
    ...issue,
    checkId: issue.checkId ?? classifyIssue(issue),
  }))
  const counters = createCounters(issues)

  let columns: string[] = []
  let totalRecords = 0
  const seenCodes = new Map<string, number>()
  const seenBarcodes = new Map<string, number>()
  let headersChecked = false
  let missingRequiredHeaders: string[] = []
  let unknownHeaders: string[] = []
  let presentOptionalHeaders: string[] = []
  const rows: Record<string, string>[] = []
  let atualizaEstoqueS = 0
  let atualizaEstoqueN = 0

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

    const flagAtualiza = String(record.atualizaestoque ?? '').trim().toUpperCase()
    if (flagAtualiza === 'S') atualizaEstoqueS++
    else if (flagAtualiza === 'N') atualizaEstoqueN++

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
      if (record.markup !== undefined && !columnSet.has('markup')) {
        columnSet.add('markup')
        const custoIdx = columns.indexOf('custo')
        columns.splice(custoIdx >= 0 ? custoIdx + 1 : columns.length, 0, 'markup')
      }
      if (record.fator !== undefined && !columnSet.has('fator')) {
        columnSet.add('fator')
        const markupIdx = columns.indexOf('markup')
        columns.splice(markupIdx >= 0 ? markupIdx + 1 : columns.length, 0, 'fator')
      }
      if (record.st !== undefined && !columnSet.has('st')) {
        columnSet.add('st')
        columns.push('st')
      }
    }

    if (rows.length < MAX_PREVIEW_ROWS) {
      rows.push({ ...record })
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

    const barcodeRaw = cell(record, 'codigobarras').trim()
    const barcodeKey = barcodeRaw.replace(/\D/g, '')
    if (barcodeKey.length >= 8) {
      const firstRow = seenBarcodes.get(barcodeKey)
      if (firstRow !== undefined) {
        pushIssue(issues, counters, {
          row: rowNumber,
          field: 'codigobarras',
          value: barcodeRaw,
          message: `Código de barras duplicado no arquivo (já apareceu na linha ${firstRow}).`,
          severity: 'error',
        })
      } else {
        seenBarcodes.set(barcodeKey, rowNumber)
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
    atualizaEstoqueSummary: { s: atualizaEstoqueS, n: atualizaEstoqueN },
  })
}

/** Revalida linhas já editadas na prévia (sem reler o CSV do disco). */
export async function validateProductRows(
  input: ValidateRowsInput
): Promise<ProductValidationResult> {
  const { catalogs, loadIssues } = await resolveAuxiliaryCatalogs(input.auxiliary)
  const tmsDcb = await loadTmsDcbForValidation()

  const issues: ValidationIssue[] = loadIssues.map((issue) => ({
    ...issue,
    checkId: issue.checkId ?? classifyIssue(issue),
  }))
  const counters = createCounters(issues)

  if (!catalogs.grupo) {
    pushIssue(issues, counters, {
      row: 0,
      field: 'grupo',
      value: '',
      message: 'Envie o arquivo auxiliar grupo.csv (obrigatório).',
      severity: 'error',
    })
  }

  let columns = input.rows[0] ? Object.keys(input.rows[0]) : [...REQUIRED_HEADERS]
  const columnSet = new Set(columns)
  const seenCodes = new Map<string, number>()
  const seenBarcodes = new Map<string, number>()
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

    if (record.markup !== undefined && !columnSet.has('markup')) {
      columnSet.add('markup')
      const custoIdx = columns.indexOf('custo')
      columns = [...columns]
      columns.splice(custoIdx >= 0 ? custoIdx + 1 : columns.length, 0, 'markup')
    }
    if (record.fator !== undefined && !columnSet.has('fator')) {
      columnSet.add('fator')
      const markupIdx = columns.indexOf('markup')
      columns = [...columns]
      columns.splice(markupIdx >= 0 ? markupIdx + 1 : columns.length, 0, 'fator')
    }
    if (record.st !== undefined && !columnSet.has('st')) {
      columnSet.add('st')
      columns = [...columns, 'st']
    }

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

    const barcodeRaw = cell(record, 'codigobarras').trim()
    const barcodeKey = barcodeRaw.replace(/\D/g, '')
    if (barcodeKey.length >= 8) {
      const firstRow = seenBarcodes.get(barcodeKey)
      if (firstRow !== undefined) {
        pushIssue(issues, counters, {
          row: rowNumber,
          field: 'codigobarras',
          value: barcodeRaw,
          message: `Código de barras duplicado (já aparece na linha ${firstRow}).`,
          severity: 'error',
        })
      } else {
        seenBarcodes.set(barcodeKey, rowNumber)
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
    atualizaEstoqueSummary: countAtualizaEstoqueFlags(rows),
  })
}
