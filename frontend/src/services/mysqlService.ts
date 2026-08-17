import { apiRequest } from '@/lib/api'
import type { ConnectionConfig, ConnectionTestResult, TableColumn } from '@/types'

export const mysqlService = {
  async testConnection(config: ConnectionConfig): Promise<ConnectionTestResult> {
    return apiRequest<ConnectionTestResult>('/mysql/test', {
      method: 'POST',
      body: JSON.stringify({
        name: config.name,
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
      }),
    })
  },

  async disconnect(sessionId: string): Promise<void> {
    await apiRequest(`/mysql/session/${sessionId}`, {
      method: 'DELETE',
      sessionId,
    })
  },

  async getTables(sessionId: string): Promise<string[]> {
    return apiRequest<string[]>('/mysql/tables', { sessionId })
  },

  async getTableColumns(table: string, sessionId: string): Promise<TableColumn[]> {
    return apiRequest<TableColumn[]>(`/mysql/tables/${encodeURIComponent(table)}/columns`, {
      sessionId,
    })
  },
}
