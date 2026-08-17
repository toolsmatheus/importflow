import type { TableColumnRow } from '../repositories/mysqlRepository.js'
import type {
  ColumnMappingInput,
  ValidationIssueRow,
  ValidationResultPayload,
} from '../schemas/import.schema.js'
import { coerceValue, isRequiredColumn } from '../utils/valueCoercion.js'
import type { StoredCsvFile } from './csvFileService.js'
import { createRecordStream, normalizeRecord, type ResolvedOptions } from './csvService.js'

const MAX_ERRORS_RETURNED = 500
const PREVIEW_ROW_LIMIT = 10
const MAX_TRACKED_KEYS = 500_000

export interface ActiveMapping {
  csvColumn: string
  column: TableColumnRow
}

export function buildActiveMappings(
  mappings: ColumnMappingInput[],
  columns: TableColumnRow[]
): ActiveMapping[] {
  const byName = new Map(columns.map((column) => [column.name.toLowerCase(), column]))

  const active: ActiveMapping[] = []
  const usedColumns = new Set<string>()

  for (const mapping of mappings) {
    if (!mapping.mysqlColumn) continue

    const column = byName.get(mapping.mysqlColumn.toLowerCase())
    if (!column) continue
    if (usedColumns.has(column.name)) continue

    usedColumns.add(column.name)
    active.push({ csvColumn: mapping.csvColumn, column })
  }

  return active
}

export function findMissingRequiredColumns(
  active: ActiveMapping[],
  columns: TableColumnRow[]
): string[] {
  const mapped = new Set(active.map((item) => item.column.name))

  return columns
    .filter((column) => isRequiredColumn(column) && !mapped.has(column.name))
    .map((column) => column.name)
}

/**
 * Percorre o CSV em streaming, valida cada registro contra os metadados da tabela
 * e devolve o resumo, as primeiras ocorrências de problema e um preview.
 */
export async function validateImport(
  file: StoredCsvFile,
  options: ResolvedOptions,
  active: ActiveMapping[],
  columns: TableColumnRow[]
): Promise<ValidationResultPayload> {
  const missingRequiredColumns = findMissingRequiredColumns(active, columns)

  const uniqueMappings = active.filter(
    (item) => item.column.key === 'PRI' || item.column.key === 'UNI'
  )
  const seenKeys = new Map<string, Set<string>>(
    uniqueMappings.map((item) => [item.column.name, new Set<string>()])
  )
  const duplicateKeyColumns = new Set<string>()

  const errors: ValidationIssueRow[] = []
  const previewRows: Record<string, string>[] = []

  let totalRecords = 0
  let validCount = 0
  let warningCount = 0
  let invalidCount = 0
  let totalIssues = 0
  let keyTrackingDisabled = false

  const stream = createRecordStream(file.filePath, options)

  for await (const raw of stream) {
    const record = normalizeRecord(raw as Record<string, string> | string[])
    totalRecords++
    const rowNumber = options.hasHeader ? totalRecords + 1 : totalRecords

    let rowHasError = false
    let rowHasWarning = false
    const previewRow: Record<string, string> = {}

    for (const { csvColumn, column } of active) {
      const rawValue = record[csvColumn]
      const { value, issues } = coerceValue(rawValue, column)

      for (const issue of issues) {
        if (issue.severity === 'error') rowHasError = true
        else rowHasWarning = true

        totalIssues++
        if (errors.length < MAX_ERRORS_RETURNED) {
          errors.push({
            row: rowNumber,
            field: csvColumn,
            value: rawValue ?? '',
            message: issue.message,
            severity: issue.severity,
          })
        }
      }

      if (seenKeys.has(column.name) && value !== null && value !== '') {
        const bucket = seenKeys.get(column.name)!

        if (!keyTrackingDisabled && bucket.size >= MAX_TRACKED_KEYS) {
          keyTrackingDisabled = true
        }

        if (!keyTrackingDisabled) {
          const key = String(value)
          if (bucket.has(key)) {
            rowHasError = true
            duplicateKeyColumns.add(column.name)
            totalIssues++
            if (errors.length < MAX_ERRORS_RETURNED) {
              errors.push({
                row: rowNumber,
                field: csvColumn,
                value: key,
                message: `Valor duplicado no arquivo para a coluna única "${column.name}".`,
                severity: 'error',
              })
            }
          } else {
            bucket.add(key)
          }
        }
      }

      if (previewRows.length < PREVIEW_ROW_LIMIT) {
        previewRow[column.name] = value === null ? '' : String(value)
      }
    }

    if (previewRows.length < PREVIEW_ROW_LIMIT) {
      previewRows.push(previewRow)
    }

    if (rowHasError) invalidCount++
    else if (rowHasWarning) warningCount++
    else validCount++
  }

  return {
    totalRecords,
    validCount,
    warningCount,
    invalidCount,
    missingRequiredColumns,
    duplicateKeyColumns: [...duplicateKeyColumns],
    errors,
    truncatedErrors: totalIssues > errors.length,
    previewRows,
    previewColumns: active.map((item) => item.column.name),
  }
}
