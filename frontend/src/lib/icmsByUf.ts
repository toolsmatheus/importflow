/**
 * Helpers de UI para revisão de alíquota.
 * Tabela e getters vêm da fonte única do backend (`@toolsdataweb/icms`).
 */
export {
  type BrazilianUf,
  type UfIcmsEntry,
  UF_ICMS_TABLE,
  getUfIcms,
  formatAliquotaCsv,
  aliquotaMatchesUf,
} from '@toolsdataweb/icms'

import {
  formatAliquotaCsv,
  getUfIcms,
  type UfIcmsEntry,
} from '@toolsdataweb/icms'

function parseAliquotaCell(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s/g, '').replace(/%/g, '')
  if (!cleaned) return null
  const hasComma = cleaned.includes(',')
  const hasDot = cleaned.includes('.')
  let normalized: string
  if (hasComma && hasDot) {
    normalized =
      cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
        ? cleaned.replace(/\./g, '').replace(',', '.')
        : cleaned.replace(/,/g, '')
  } else if (hasComma) {
    normalized = cleaned.replace(',', '.')
  } else {
    normalized = cleaned
  }
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

export interface AliquotaMismatch {
  rowIndex: number
  /** Linha CSV (header = 1 → dados começam em 2). */
  row: number
  codigo: string
  nome: string
  codigobarras: string
  codigogrupo: string
  current: number
  currentRaw: string
  expected: number
}

const TOLERANCE = 0.001

export function findAliquotaMismatches(
  rows: Record<string, string>[],
  uf: string
): { expected: number; entry: UfIcmsEntry; mismatches: AliquotaMismatch[] } | null {
  const entry = getUfIcms(uf)
  if (!entry) return null

  const mismatches: AliquotaMismatch[] = []
  rows.forEach((row, rowIndex) => {
    const raw = String(row.aliquota ?? '').trim()
    const value = parseAliquotaCell(raw)
    if (value === null || value <= 0) return
    if (Math.abs(value - entry.aliquota) <= TOLERANCE) return
    mismatches.push({
      rowIndex,
      row: rowIndex + 2,
      codigo: String(row.codigo ?? '').trim(),
      nome: String(row.nome ?? '').trim(),
      codigobarras: String(row.codigobarras ?? '').trim(),
      codigogrupo: String(row.codigogrupo ?? '').trim(),
      current: value,
      currentRaw: raw,
      expected: entry.aliquota,
    })
  })

  return { expected: entry.aliquota, entry, mismatches }
}

/** Agrupa divergências pela alíquota atual (resumo na UI). */
export function summarizeAliquotaMismatches(
  mismatches: AliquotaMismatch[]
): Array<{ aliquota: number; label: string; count: number }> {
  const map = new Map<number, number>()
  for (const m of mismatches) {
    const key = Math.round(m.current * 1000) / 1000
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([aliquota, count]) => ({
      aliquota,
      label: formatAliquotaCsv(aliquota),
      count,
    }))
}

export function applyExpectedAliquota(
  rows: Record<string, string>[],
  mismatches: AliquotaMismatch[],
  expected: number
): Record<string, string>[] {
  const formatted = formatAliquotaCsv(expected)
  const indexSet = new Set(mismatches.map((m) => m.rowIndex))
  return rows.map((row, index) => {
    if (!indexSet.has(index)) return row
    return { ...row, aliquota: formatted }
  })
}
