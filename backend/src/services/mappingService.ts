import type { ColumnMappingItem } from '../schemas/mapping.schema.js'
import { getMatchScore } from '../utils/normalize.js'

interface MysqlColumnInput {
  name: string
}

const MIN_MATCH_SCORE = 55

interface ScoredPair {
  csvColumn: string
  mysqlColumn: string
  score: number
}

export function suggestMappings(
  csvColumns: string[],
  mysqlColumns: MysqlColumnInput[]
): ColumnMappingItem[] {
  const mysqlNames = mysqlColumns.map((col) => col.name)
  const pairs: ScoredPair[] = []

  for (const csvColumn of csvColumns) {
    for (const mysqlColumn of mysqlNames) {
      const score = getMatchScore(csvColumn, mysqlColumn)

      if (score >= MIN_MATCH_SCORE) {
        pairs.push({ csvColumn, mysqlColumn, score })
      }
    }
  }

  pairs.sort((a, b) => b.score - a.score)

  const assignedCsv = new Set<string>()
  const assignedMysql = new Set<string>()
  const suggestions = new Map<string, string>()

  for (const pair of pairs) {
    if (assignedCsv.has(pair.csvColumn) || assignedMysql.has(pair.mysqlColumn)) {
      continue
    }

    assignedCsv.add(pair.csvColumn)
    assignedMysql.add(pair.mysqlColumn)
    suggestions.set(pair.csvColumn, pair.mysqlColumn)
  }

  return csvColumns.map((csvColumn) => {
    const mysqlColumn = suggestions.get(csvColumn) ?? null

    return {
      csvColumn,
      mysqlColumn,
      suggested: mysqlColumn !== null,
    }
  })
}
