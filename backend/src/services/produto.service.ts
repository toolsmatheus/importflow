import {
  CONTROLADOS_HEADERS,
  FARMACIA_POPULAR_HEADERS,
  OPTIONAL_HEADERS,
  REQUIRED_HEADERS,
  TEMPLATE_DELIMITER,
} from '../schemas/product.schema.js'
import { isValidMigrationCode } from '../utils/productFormats.js'
import { type StoredCsvFile } from '../models/csv.model.js'
import { createRecordStream, normalizeRecord, resolveCsvOptions } from './csv.service.js'
import { resolverCatalogosAuxiliares } from './validacao/validacaoAuxiliar.js'
import {
  countMissingPrimaryBarcodes,
  pushMissingBarcodeSummary,
  trackFileBarcodeKeys,
} from './validacao/validacaoCodigoBarras.js'
import { montarResumoChecagem, classifyIssue } from './validacao/resumoChecagem.js'
import { loadTmsDcbForValidation } from './validacao/validacaoControlado.js'
import {
  criarContadores,
  isIssueListTruncated,
  empurrarIssue,
} from './validacao/contadores.js'
import { validarLinha } from './validacao/validacaoLinha.js'
import {
  cell,
  KNOWN_HEADERS,
  LEGACY_IGNORED_HEADERS,
  MAX_PREVIEW_ROWS,
  type IssueCounters,
  type ResultadoValidacaoProduto,
  type ValidateProductInput,
  type ValidateRowsInput,
  type IssueValidacao,
} from './validacao/tipos.js'

export type {
  IssueSeverity,
  ResultadoValidacaoProduto,
  ValidateProductInput,
  ValidateRowsInput,
  ValidationCheckSummaryItem,
  IssueValidacao,
} from './validacao/tipos.js'

export {
  validateBodySchema,
  validarLinhasBodySchema,
} from './validacao/tipos.js'

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
    ResultadoValidacaoProduto,
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
): ResultadoValidacaoProduto {
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
    checkSummary: montarResumoChecagem(base.counters.categories),
    atualizaEstoqueSummary: base.atualizaEstoqueSummary ?? { s: 0, n: 0 },
    errorRows: [...base.counters.errorRows].sort((a, b) => a - b),
    truncated: isIssueListTruncated(base.counters),
    columns: base.columns,
    rows: base.rows,
  }
}

export async function validarCsvProduto(
  file: StoredCsvFile,
  input: ValidateProductInput
): Promise<ResultadoValidacaoProduto> {
  const { catalogs, loadIssues } = await resolverCatalogosAuxiliares(input.auxiliary)
  const tmsDcb = await loadTmsDcbForValidation()

  const options = await resolveCsvOptions(file.filePath, {
    delimiter: input.delimiter ?? TEMPLATE_DELIMITER,
    encoding: input.encoding,
    hasHeader: true,
  })

  const issues: IssueValidacao[] = loadIssues.map((issue) => ({
    ...issue,
    checkId: issue.checkId ?? classifyIssue(issue),
  }))
  const counters = criarContadores(issues)

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
    empurrarIssue(issues, counters, {
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
        empurrarIssue(issues, counters, {
          row: 1,
          field: header,
          value: '',
          message: 'Coluna obrigatória ausente no cabeçalho do CSV.',
          severity: 'error',
        })
      }

      for (const header of unknownHeaders) {
        empurrarIssue(issues, counters, {
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

    // Vazio/ausente conta como S (mesmo padrão do envio).
    const flagAtualiza = String(record.atualizaestoque ?? '').trim().toUpperCase()
    if (flagAtualiza === 'N') atualizaEstoqueN++
    else atualizaEstoqueS++

    if (missingRequiredHeaders.length === 0) {
      const barcodeKeys = validarLinha(
        record,
        rowNumber,
        columnSet,
        catalogs,
        issues,
        counters,
        tmsDcb,
        input.clientUf
      )
      const primaryRaw = cell(record, 'codigobarras').trim()
      const primaryKey = primaryRaw.replace(/\D/g, '')
      const primaryKeys = primaryKey.length >= 8 ? [primaryKey] : []
      const additionalKeys = barcodeKeys.filter((k) => k !== primaryKey)
      trackFileBarcodeKeys(
        seenBarcodes,
        primaryKeys,
        rowNumber,
        issues,
        counters,
        primaryRaw,
        'codigobarras'
      )
      trackFileBarcodeKeys(
        seenBarcodes,
        additionalKeys,
        rowNumber,
        issues,
        counters,
        cell(record, 'codigoadicional').trim() || additionalKeys[0] || '',
        'codigoadicional'
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
        empurrarIssue(issues, counters, {
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
    empurrarIssue(issues, counters, {
      row: 1,
      field: '',
      value: '',
      message: 'O arquivo não contém nenhum registro de produto.',
      severity: 'error',
    })
  }

  pushMissingBarcodeSummary(
    countMissingPrimaryBarcodes(rows, columnSet),
    totalRecords,
    issues,
    counters
  )

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
export async function validarLinhasProduto(
  input: ValidateRowsInput
): Promise<ResultadoValidacaoProduto> {
  const { catalogs, loadIssues } = await resolverCatalogosAuxiliares(input.auxiliary)
  const tmsDcb = await loadTmsDcbForValidation()

  const issues: IssueValidacao[] = loadIssues.map((issue) => ({
    ...issue,
    checkId: issue.checkId ?? classifyIssue(issue),
  }))
  const counters = criarContadores(issues)

  if (!catalogs.grupo) {
    empurrarIssue(issues, counters, {
      row: 0,
      field: 'grupo',
      value: '',
      message: 'Envie o arquivo auxiliar grupo.csv (obrigatório).',
      severity: 'error',
    })
  }

  let columns = input.rows[0] ? Object.keys(input.rows[0]) : [...REQUIRED_HEADERS]
  const columnSet = new Set(columns)
  for (const row of input.rows) {
    for (const key of Object.keys(row)) {
      if (!columnSet.has(key)) {
        columnSet.add(key)
        columns = [...columns, key]
      }
    }
  }
  const seenCodes = new Map<string, number>()
  const seenBarcodes = new Map<string, number>()
  const rows = input.rows.map((row) => ({ ...row }))

  rows.forEach((record, index) => {
    const rowNumber = index + 2
    const barcodeKeys = validarLinha(
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
        empurrarIssue(issues, counters, {
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

    const primaryRaw = cell(record, 'codigobarras').trim()
    const primaryKey = primaryRaw.replace(/\D/g, '')
    const primaryKeys = primaryKey.length >= 8 ? [primaryKey] : []
    const additionalKeys = barcodeKeys.filter((k) => k !== primaryKey)
    trackFileBarcodeKeys(
      seenBarcodes,
      primaryKeys,
      rowNumber,
      issues,
      counters,
      primaryRaw,
      'codigobarras'
    )
    trackFileBarcodeKeys(
      seenBarcodes,
      additionalKeys,
      rowNumber,
      issues,
      counters,
      cell(record, 'codigoadicional').trim() || additionalKeys[0] || '',
      'codigoadicional'
    )
  })

  pushMissingBarcodeSummary(
    countMissingPrimaryBarcodes(rows, columnSet),
    rows.length,
    issues,
    counters
  )

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
