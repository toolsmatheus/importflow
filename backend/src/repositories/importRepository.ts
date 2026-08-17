import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type mysql from 'mysql2/promise'

export type CellValue = string | number | null

/**
 * Nomes de tabela e coluna vêm do INFORMATION_SCHEMA (ou já foram validados),
 * mas escapamos backticks para nunca permitir quebra do identificador.
 */
function quote(identifier: string): string {
  return `\`${identifier.replace(/`/g, '``')}\``
}

function columnList(columns: string[]): string {
  return columns.map(quote).join(', ')
}

/**
 * `VALUES(col)` no ON DUPLICATE KEY UPDATE ficou deprecado no MySQL 8.0.19,
 * que introduziu o alias de linha. Detectamos a versão para usar a sintaxe
 * correta e continuar compatível com 5.7.
 */
export async function supportsRowAlias(connection: mysql.Connection): Promise<boolean> {
  const [rows] = await connection.query<RowDataPacket[]>('SELECT VERSION() AS version')
  const version = String(rows[0]?.version ?? '')

  if (version.toLowerCase().includes('mariadb')) return false

  const [major, minor, patch] = version.split('-')[0].split('.').map(Number)
  if (!Number.isFinite(major)) return false
  if (major > 8) return true
  if (major < 8) return false
  if ((minor ?? 0) > 0) return true
  return (patch ?? 0) >= 19
}

export async function insertBatch(
  connection: mysql.Connection,
  table: string,
  columns: string[],
  rows: CellValue[][]
): Promise<ResultSetHeader> {
  const sql = `INSERT INTO ${quote(table)} (${columnList(columns)}) VALUES ?`
  const [result] = await connection.query<ResultSetHeader>(sql, [rows])
  return result
}

export async function upsertBatch(
  connection: mysql.Connection,
  table: string,
  columns: string[],
  updateColumns: string[],
  rows: CellValue[][],
  useRowAlias: boolean
): Promise<ResultSetHeader> {
  const assignments = updateColumns
    .map((column) =>
      useRowAlias
        ? `${quote(column)} = novo.${quote(column)}`
        : `${quote(column)} = VALUES(${quote(column)})`
    )
    .join(', ')

  const alias = useRowAlias ? ' AS novo' : ''
  const sql =
    `INSERT INTO ${quote(table)} (${columnList(columns)}) VALUES ?${alias}` +
    ` ON DUPLICATE KEY UPDATE ${assignments}`

  const [result] = await connection.query<ResultSetHeader>(sql, [rows])
  return result
}

export async function updateRow(
  connection: mysql.Connection,
  table: string,
  setColumns: string[],
  keyColumns: string[],
  setValues: CellValue[],
  keyValues: CellValue[]
): Promise<ResultSetHeader> {
  const assignments = setColumns.map((column) => `${quote(column)} = ?`).join(', ')
  const where = keyColumns.map((column) => `${quote(column)} = ?`).join(' AND ')
  const sql = `UPDATE ${quote(table)} SET ${assignments} WHERE ${where}`

  const [result] = await connection.execute<ResultSetHeader>(sql, [...setValues, ...keyValues])
  return result
}

/**
 * O MySQL informa quantas linhas de um INSERT ... ON DUPLICATE KEY UPDATE
 * caíram em chave existente através da string `info`:
 * "Records: 500  Duplicates: 120  Warnings: 0".
 */
export function parseDuplicates(info: string | undefined, fallbackTotal: number): {
  inserted: number
  updated: number
} {
  const match = info?.match(/Records:\s*(\d+)\s+Duplicates:\s*(\d+)/i)

  if (!match) {
    return { inserted: fallbackTotal, updated: 0 }
  }

  const records = Number(match[1])
  const duplicates = Number(match[2])

  return { inserted: Math.max(0, records - duplicates), updated: duplicates }
}
