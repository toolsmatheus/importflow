import mysql from 'mysql2/promise'
import type { ConnectionConfig } from '../schemas/mysql.schema.js'
import { fetchTableColumns, fetchTables } from '../repositories/mysqlRepository.js'
import type { TableColumnRow } from '../repositories/mysqlRepository.js'
import { getFriendlyMysqlError } from '../utils/mysqlErrors.js'
import { createSession, deleteSession, getSession, getSessionPublicInfo } from './sessionService.js'
import type { SessionData } from './sessionService.js'

export interface TestConnectionResult {
  success: boolean
  host?: string
  port?: number
  database?: string
  responseTimeMs?: number
  sessionId?: string
  connectionName?: string
  message?: string
}

export async function testConnection(config: ConnectionConfig): Promise<TestConnectionResult> {
  const start = Date.now()

  let connection: mysql.Connection | undefined

  try {
    connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      connectTimeout: 10000,
    })

    await connection.ping()

    const responseTimeMs = Date.now() - start
    const session = createSession(config)
    const publicInfo = getSessionPublicInfo(session)

    return {
      success: true,
      host: publicInfo.host,
      port: publicInfo.port,
      database: publicInfo.database,
      responseTimeMs,
      sessionId: publicInfo.sessionId,
      connectionName: publicInfo.connectionName,
    }
  } catch (error) {
    return {
      success: false,
      message: getFriendlyMysqlError(error),
    }
  } finally {
    if (connection) {
      await connection.end().catch(() => undefined)
    }
  }
}

export async function createConnectionFromSession(
  sessionId: string,
  options?: Partial<mysql.ConnectionOptions>
): Promise<mysql.Connection | null> {
  const session = getSession(sessionId)
  if (!session) return null

  return mysql.createConnection({
    host: session.host,
    port: session.port,
    user: session.user,
    password: session.password,
    database: session.database,
    connectTimeout: 10000,
    ...options,
  })
}

export function closeSession(sessionId: string): boolean {
  return deleteSession(sessionId)
}

async function withSessionConnection<T>(
  sessionId: string,
  fn: (connection: mysql.Connection, session: SessionData) => Promise<T>
): Promise<{ data: T } | { error: 'session_not_found' } | { error: 'mysql_error'; message: string }> {
  const session = getSession(sessionId)
  if (!session) {
    return { error: 'session_not_found' }
  }

  let connection: mysql.Connection | undefined

  try {
    connection = await mysql.createConnection({
      host: session.host,
      port: session.port,
      user: session.user,
      password: session.password,
      database: session.database,
      connectTimeout: 10000,
    })

    const data = await fn(connection, session)
    return { data }
  } catch (error) {
    return { error: 'mysql_error', message: getFriendlyMysqlError(error) }
  } finally {
    if (connection) {
      await connection.end().catch(() => undefined)
    }
  }
}

export async function getTables(sessionId: string): Promise<
  | { success: true; tables: string[] }
  | { success: false; message: string; status: number }
> {
  const result = await withSessionConnection(sessionId, async (connection, session) =>
    fetchTables(connection, session.database)
  )

  if ('error' in result) {
    if (result.error === 'session_not_found') {
      return { success: false, message: 'Sessão expirada ou inválida. Teste a conexão novamente.', status: 401 }
    }
    return { success: false, message: result.message, status: 500 }
  }

  return { success: true, tables: result.data }
}

export async function getTableColumns(
  sessionId: string,
  table: string
): Promise<
  | { success: true; columns: TableColumnRow[] }
  | { success: false; message: string; status: number }
> {
  const result = await withSessionConnection(sessionId, async (connection, session) =>
    fetchTableColumns(connection, session.database, table)
  )

  if ('error' in result) {
    if (result.error === 'session_not_found') {
      return { success: false, message: 'Sessão expirada ou inválida. Teste a conexão novamente.', status: 401 }
    }
    return { success: false, message: result.message, status: 500 }
  }

  if (result.data.length === 0) {
    return { success: false, message: 'Tabela não encontrada.', status: 404 }
  }

  return { success: true, columns: result.data }
}
