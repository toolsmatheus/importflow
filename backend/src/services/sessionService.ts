import { randomUUID } from 'crypto'
import type { ConnectionConfig } from '../schemas/mysql.schema.js'

export interface SessionData {
  id: string
  connectionName: string
  host: string
  port: number
  database: string
  user: string
  password: string
  createdAt: Date
  lastAccessedAt: Date
}

const SESSION_TTL_MS = 2 * 60 * 60 * 1000 // 2 horas

const sessions = new Map<string, SessionData>()

function cleanupExpiredSessions(): void {
  const now = Date.now()
  for (const [id, session] of sessions) {
    if (now - session.lastAccessedAt.getTime() > SESSION_TTL_MS) {
      sessions.delete(id)
    }
  }
}

export function createSession(config: ConnectionConfig): SessionData {
  cleanupExpiredSessions()

  const session: SessionData = {
    id: randomUUID(),
    connectionName: config.name,
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    createdAt: new Date(),
    lastAccessedAt: new Date(),
  }

  sessions.set(session.id, session)
  return session
}

export function getSession(sessionId: string): SessionData | undefined {
  const session = sessions.get(sessionId)
  if (!session) return undefined

  if (Date.now() - session.lastAccessedAt.getTime() > SESSION_TTL_MS) {
    sessions.delete(sessionId)
    return undefined
  }

  session.lastAccessedAt = new Date()
  return session
}

export function deleteSession(sessionId: string): boolean {
  return sessions.delete(sessionId)
}

export function getSessionPublicInfo(session: SessionData) {
  return {
    sessionId: session.id,
    connectionName: session.connectionName,
    host: session.host,
    port: session.port,
    database: session.database,
  }
}
