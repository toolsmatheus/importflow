import { createHash } from 'crypto'
import { DEFAULT_TMS_BASE, TMS_AUTH_SUFFIX } from './tmsConfig.js'
import type { ServerIdentification, TmsAuth } from './tmsTypes.js'

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function unwrapTmsObject(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object') return null
  const obj = payload as Record<string, unknown>
  for (const key of ['value', 'result', 'Result', 'Value', 'dados']) {
    const nested = obj[key]
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return nested as Record<string, unknown>
    }
  }
  return obj
}

function extractIdFilial(payload: unknown): number | null {
  const obj = unwrapTmsObject(payload)
  if (!obj) return null

  const direct = obj.IdFilial ?? obj.idFilial ?? obj.id_filial ?? obj.IDFILIAL
  if (typeof direct === 'number') return direct
  if (typeof direct === 'string' && /^\d+$/.test(direct)) return Number(direct)

  for (const key of ['value', 'result', 'Result', 'Value', 'dados']) {
    const nested = (payload as Record<string, unknown>)?.[key]
    const found = extractIdFilial(nested)
    if (found !== null) return found
  }

  return null
}

function extractVersao(payload: unknown): string | null {
  const obj = unwrapTmsObject(payload)
  if (!obj) return null

  const direct = obj.Versao ?? obj.versao ?? obj.VERSION ?? obj.version
  if (typeof direct === 'string' && direct.trim()) return direct.trim()

  for (const key of ['value', 'result', 'Result', 'Value', 'dados']) {
    const nested = (payload as Record<string, unknown>)?.[key]
    const found = extractVersao(nested)
    if (found) return found
  }

  return null
}

export function buildTmsBasicAuthorization(versao: string): string {
  const username = sha256Hex(versao)
  const password = sha256Hex(`${versao}${TMS_AUTH_SUFFIX}`)
  const token = Buffer.from(`${username}:${password}`, 'utf8').toString('base64')
  return `Basic ${token}`
}

export async function fetchServerIdentification(
  baseUrl = DEFAULT_TMS_BASE
): Promise<ServerIdentification> {
  const url = `${baseUrl.replace(/\/$/, '')}/tms/xdata/ServerToolsService/IdentificacaoServidor`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
  } catch {
    throw new Error(
      `Não foi possível conectar ao banco em ${url}. Verifique se o serviço está no ar.`
    )
  }

  const text = await response.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!response.ok) {
    throw new Error(`IdentificacaoServidor retornou HTTP ${response.status}.`)
  }

  const idFilial = extractIdFilial(data)
  if (idFilial === null) {
    throw new Error(
      'Resposta de IdentificacaoServidor sem IdFilial reconhecível. Ajuste o parser conforme o contrato real.'
    )
  }

  const versao = extractVersao(data)
  if (!versao) {
    throw new Error(
      'Resposta de IdentificacaoServidor sem Versao. Ela é necessária para autenticar no banco.'
    )
  }

  return { idFilial, versao, raw: data }
}

const authCache = new Map<string, { auth: TmsAuth; fetchedAt: number }>()
const AUTH_TTL_MS = 30 * 60 * 1000

export async function getTmsAuth(baseUrl = DEFAULT_TMS_BASE): Promise<TmsAuth> {
  const key = baseUrl.replace(/\/$/, '')
  const cached = authCache.get(key)
  if (cached && Date.now() - cached.fetchedAt < AUTH_TTL_MS) {
    return cached.auth
  }

  const identification = await fetchServerIdentification(key)
  const auth: TmsAuth = {
    idFilial: identification.idFilial,
    versao: identification.versao,
    authorization: buildTmsBasicAuthorization(identification.versao),
  }
  authCache.set(key, { auth, fetchedAt: Date.now() })
  return auth
}

export function invalidateTmsAuth(baseUrl = DEFAULT_TMS_BASE) {
  authCache.delete(baseUrl.replace(/\/$/, ''))
}
