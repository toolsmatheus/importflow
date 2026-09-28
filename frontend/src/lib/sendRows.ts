import type { ProductValidationResult, ValidationIssue } from '@/types'

/** Linha do CSV com cabeçalho = 1 → índice 0 em `rows`. */
export function csvRowToIndex(csvRow: number): number {
  return csvRow - 2
}

export function collectErrorRowNumbers(
  result: Pick<ProductValidationResult, 'errorRows' | 'issues'>
): Set<number> {
  if (result.errorRows && result.errorRows.length > 0) {
    return new Set(result.errorRows)
  }
  return new Set(
    (result.issues ?? [])
      .filter((i: ValidationIssue) => i.severity === 'error' && i.row > 0)
      .map((i) => i.row)
  )
}

/**
 * Remove linhas com erro de validação do lote de envio.
 * `rows` deve estar na mesma ordem do CSV (índice 0 = linha 2).
 */
export function filterRowsWithoutErrors(
  rows: Record<string, string>[],
  result: Pick<ProductValidationResult, 'errorRows' | 'issues'>
): { validRows: Record<string, string>[]; skippedCount: number; errorRowNumbers: number[] } {
  const errorRowNumbers = [...collectErrorRowNumbers(result)].sort((a, b) => a - b)
  const errorSet = new Set(errorRowNumbers)
  const validRows = rows.filter((_, index) => !errorSet.has(index + 2))
  return {
    validRows,
    skippedCount: rows.length - validRows.length,
    errorRowNumbers,
  }
}
