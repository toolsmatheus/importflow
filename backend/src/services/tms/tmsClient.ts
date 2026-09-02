import { getTmsAuth, invalidateTmsAuth } from './tmsAuth.js'
import type { BatchInsertResult } from './tmsTypes.js'

export async function tmsJsonRequest(
  url: string,
  init: { method: string; body?: string },
  baseUrl: string
): Promise<BatchInsertResult> {
  const auth = await getTmsAuth(baseUrl)
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: auth.authorization,
  }
  if (init.body) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(url, { method: init.method, headers, body: init.body })
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : `Falha de rede ao chamar ${url}`,
    }
  }

  if (response.status === 401) {
    invalidateTmsAuth(baseUrl)
    const retryAuth = await getTmsAuth(baseUrl)
    try {
      response = await fetch(url, {
        method: init.method,
        headers: { ...headers, Authorization: retryAuth.authorization },
        body: init.body,
      })
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : `Falha de rede ao chamar ${url}`,
      }
    }
  }

  const text = await response.text().catch(() => '')
  if (!response.ok) {
    return {
      ok: false,
      statusCode: response.status,
      message: text || `HTTP ${response.status}`,
    }
  }

  return { ok: true, statusCode: response.status, message: text || undefined }
}

export function extractODataRows(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== 'object') return []
  const obj = payload as Record<string, unknown>
  if (Array.isArray(obj.value)) {
    return obj.value.filter((item) => item && typeof item === 'object') as Record<
      string,
      unknown
    >[]
  }
  if (Array.isArray(payload)) {
    return payload.filter((item) => item && typeof item === 'object') as Record<
      string,
      unknown
    >[]
  }
  return []
}

export function extractCreatedEntityId(payloadText: string | undefined): number | null {
  if (!payloadText) return null
  try {
    const parsed = JSON.parse(payloadText) as unknown
    const rows = extractODataRows(parsed)
    if (rows.length > 0) {
      const id = Number(rows[0].id)
      if (Number.isFinite(id)) return id
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const id = Number((parsed as Record<string, unknown>).id)
      if (Number.isFinite(id)) return id
    }
  } catch {
    /* ignore */
  }
  return null
}

export function migracaoKey(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  return String(value).trim()
}

export function buildMigracaoMap(rows: Record<string, unknown>[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows) {
    const id = Number(row.id)
    if (!Number.isFinite(id)) continue
    const key = migracaoKey(row.codigo_migracao)
    if (key === null) continue
    map.set(key, id)
  }
  return map
}

export async function fetchTmsEntityRows(
  entityPath: string,
  baseUrl: string,
  pageSize = 2000
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = []
  let skip = 0
  const root = baseUrl.replace(/\/$/, '')

  while (true) {
    const url = `${root}/tms/xdata/${entityPath}?$top=${pageSize}&$skip=${skip}`
    const result = await tmsJsonRequest(url, { method: 'GET' }, baseUrl)
    if (!result.ok) {
      throw new Error(result.message || `Falha ao listar ${entityPath} no banco`)
    }

    let parsed: unknown = null
    try {
      parsed = result.message ? JSON.parse(result.message) : null
    } catch {
      parsed = null
    }

    const page = extractODataRows(parsed)
    rows.push(...page)
    if (page.length < pageSize) break
    skip += pageSize
  }

  return rows
}
