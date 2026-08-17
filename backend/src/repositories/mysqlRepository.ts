import type { RowDataPacket } from 'mysql2/promise'
import type mysql from 'mysql2/promise'

export interface TableColumnRow {
  name: string
  type: string
  columnType: string
  nullable: boolean
  key: string
  maxLength: number | null
  numericPrecision: number | null
  numericScale: number | null
  defaultValue: string | null
  autoIncrement: boolean
}

export async function fetchTables(
  connection: mysql.Connection,
  database: string
): Promise<string[]> {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
     ORDER BY TABLE_NAME`,
    [database]
  )

  return rows.map((row) => String(row.TABLE_NAME))
}

export async function fetchTableColumns(
  connection: mysql.Connection,
  database: string,
  table: string
): Promise<TableColumnRow[]> {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT
       COLUMN_NAME,
       DATA_TYPE,
       COLUMN_TYPE,
       IS_NULLABLE,
       COLUMN_KEY,
       CHARACTER_MAXIMUM_LENGTH,
       NUMERIC_PRECISION,
       NUMERIC_SCALE,
       COLUMN_DEFAULT,
       EXTRA
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [database, table]
  )

  return rows.map((row) => ({
    name: String(row.COLUMN_NAME),
    type: String(row.DATA_TYPE).toLowerCase(),
    columnType: String(row.COLUMN_TYPE ?? '').toLowerCase(),
    nullable: row.IS_NULLABLE === 'YES',
    key: row.COLUMN_KEY ? String(row.COLUMN_KEY) : '',
    maxLength: row.CHARACTER_MAXIMUM_LENGTH !== null ? Number(row.CHARACTER_MAXIMUM_LENGTH) : null,
    numericPrecision: row.NUMERIC_PRECISION !== null ? Number(row.NUMERIC_PRECISION) : null,
    numericScale: row.NUMERIC_SCALE !== null ? Number(row.NUMERIC_SCALE) : null,
    defaultValue: row.COLUMN_DEFAULT !== null ? String(row.COLUMN_DEFAULT) : null,
    autoIncrement: String(row.EXTRA ?? '').toLowerCase().includes('auto_increment'),
  }))
}
