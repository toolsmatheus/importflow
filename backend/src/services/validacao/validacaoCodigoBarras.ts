import {
  eanValidationFailureReason,
  isBlank,
  parseCodigoAdicionalList,
} from '../../utils/productFormats.js'
import { empurrarIssue } from './contadores.js'
import { cell, hasColumn, type IssueCounters, type IssueValidacao } from './tipos.js'

/** Partes brutas de codigoadicional (antes de dedupe / exclusão do principal). */
export function rawCodigoAdicionalParts(raw: string): string[] {
  if (!raw.trim()) return []
  return raw
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean)
}

/**
 * Valida EAN principal e codigoadicional na linha.
 * Retorna chaves digitadas (≥8) para dedupe no arquivo.
 */
export function validarCodigosBarrasLinha(
  record: Record<string, string>,
  rowNumber: number,
  columns: Set<string>,
  issues: IssueValidacao[],
  counters: IssueCounters
): string[] {
  const keys: string[] = []

  if (hasColumn(columns, 'codigobarras')) {
    const ean = cell(record, 'codigobarras').trim()
    if (!isBlank(ean)) {
      const reason = eanValidationFailureReason(ean)
      if (reason) {
        empurrarIssue(issues, counters, {
          row: rowNumber,
          field: 'codigobarras',
          value: ean,
          message: `Código de barras inválido (${reason}).`,
          severity: 'warning',
        })
      }
      const key = ean.replace(/\D/g, '')
      if (key.length >= 8) keys.push(key)
    }
  }

  if (!hasColumn(columns, 'codigoadicional')) return keys

  const primary = cell(record, 'codigobarras').trim()
  const primaryDigits = primary.replace(/\D/g, '')
  const rawParts = rawCodigoAdicionalParts(cell(record, 'codigoadicional'))
  const seenLocal = new Set<string>()

  for (const part of rawParts) {
    const digits = part.replace(/\D/g, '')
    const key = digits || part
    if (primaryDigits && key === primaryDigits) {
      empurrarIssue(issues, counters, {
        row: rowNumber,
        field: 'codigoadicional',
        value: part,
        message:
          'Código adicional igual ao EAN principal — será ignorado no envio.',
        severity: 'warning',
      })
      continue
    }
    if (seenLocal.has(key)) {
      empurrarIssue(issues, counters, {
        row: rowNumber,
        field: 'codigoadicional',
        value: part,
        message: 'Código adicional repetido na mesma linha — será enviado uma vez.',
        severity: 'warning',
      })
      continue
    }
    seenLocal.add(key)
  }

  const extras = parseCodigoAdicionalList(cell(record, 'codigoadicional'), primary)
  for (const extra of extras) {
    const reason = eanValidationFailureReason(extra)
    if (reason) {
      empurrarIssue(issues, counters, {
        row: rowNumber,
        field: 'codigoadicional',
        value: extra,
        message: `Código de barras adicional inválido (${reason}).`,
        severity: 'warning',
      })
    }
    const key = extra.replace(/\D/g, '')
    if (key.length >= 8) keys.push(key)
  }

  return keys
}

/** Conta linhas com coluna codigobarras presente e valor vazio. */
export function countMissingPrimaryBarcodes(
  rows: Iterable<Record<string, string>>,
  columns: Set<string>
): number {
  if (!hasColumn(columns, 'codigobarras')) return 0
  let missing = 0
  for (const row of rows) {
    if (isBlank(cell(row, 'codigobarras'))) missing++
  }
  return missing
}

export function pushMissingBarcodeSummary(
  missingCount: number,
  totalRows: number,
  issues: IssueValidacao[],
  counters: IssueCounters
) {
  if (missingCount <= 0 || totalRows <= 0) return
  empurrarIssue(issues, counters, {
    row: 0,
    field: 'codigobarras',
    value: '',
    message: `${missingCount} de ${totalRows} produto(s) sem código de barras — serão importados sem codigoBarras no TMS.`,
    severity: 'warning',
  })
}

export function trackFileBarcodeKeys(
  seenBarcodes: Map<string, number>,
  keys: string[],
  rowNumber: number,
  issues: IssueValidacao[],
  counters: IssueCounters,
  /** Valor exibido na mensagem (primeiro key da linha ou raw). */
  displayValue: string,
  field: 'codigobarras' | 'codigoadicional' = 'codigobarras'
) {
  for (const key of keys) {
    if (key.length < 8) continue
    const firstRow = seenBarcodes.get(key)
    if (firstRow !== undefined) {
      empurrarIssue(issues, counters, {
        row: rowNumber,
        field,
        value: displayValue || key,
        message: `Código de barras duplicado no arquivo (já apareceu na linha ${firstRow}).`,
        severity: 'error',
      })
    } else {
      seenBarcodes.set(key, rowNumber)
    }
  }
}
