import { createHash } from 'crypto'
import { parseBrazilianNumber, isBlank } from '../utils/productFormats.js'
import { lookupAnvisaDcb, padDcbCode } from './dcbIndexService.js'

const DEFAULT_TMS_BASE = process.env.TMS_BASE_URL ?? 'http://localhost:2001'
/** Sufixo combinado com a versão para gerar a senha Basic Auth do TMS. */
const TMS_AUTH_SUFFIX = process.env.TMS_AUTH_SUFFIX ?? 'k3g88Ii5nQr7Z2D6sPTP'

export interface ServerIdentification {
  idFilial: number
  versao: string
  raw: unknown
}

export interface TmsAuth {
  idFilial: number
  versao: string
  authorization: string
}

export interface BatchInsertResult {
  ok: boolean
  message?: string
  statusCode?: number
}

function snToBool(value: string | undefined): boolean | undefined {
  if (isBlank(value)) return undefined
  const v = value!.trim().toUpperCase()
  if (v === 'S') return true
  if (v === 'N') return false
  return undefined
}

function num(value: string | undefined): number | undefined {
  if (isBlank(value)) return undefined
  return parseBrazilianNumber(value!) ?? undefined
}

function int(value: string | undefined): number | undefined {
  if (isBlank(value)) return undefined
  const n = Number(value!.trim())
  return Number.isInteger(n) ? n : undefined
}

function str(value: string | undefined): string | undefined {
  if (isBlank(value)) return undefined
  return value!.trim()
}

/**
 * Mapeia uma linha do CSV para o payload do ProdutoService/insert.
 * Contrato provisório até a API TMS fechar.
 */
export function mapCsvRowToProductPayload(
  row: Record<string, string>,
  idFilial: number
): Record<string, unknown> {
  const cstPisCofins = str(row.cstpiscofins)

  return {
    idFilial,
    codigo_migracao: str(row.codigo),
    nome: str(row.nome),
    idGrupo: int(row.codigogrupo),
    custo: num(row.custo),
    markup: num(row.markup),
    venda: num(row.venda),
    unidade: str(row.unidade),
    fator: num(row.fator),
    listapiscofins: str(row.listapiscofins)?.toUpperCase(),
    aliquotaicms: num(row.aliquota),
    cfop: str(row.cfop),
    ncm: str(row.ncm),
    cstpis: cstPisCofins,
    cstcofins: cstPisCofins,
    valorpmc: num(row.valorpmc),
    codigobarras: str(row.codigobarras),
    idSubgrupo: int(row.subgrupo),
    idCategoria: int(row.categoria),
    idLaboratorio: int(row.laboratorio),
    idGrupodepreco: int(row.grupodepreco),
    idSimilar: int(row.similar),
    estoque: num(row.estoque),
    descontofixo: num(row.descontofixo),
    comissao: num(row.comissao),
    atualizaestoque: snToBool(row.atualizaestoque),
    demanda: num(row.demanda),
    ativo: str(row.ativo)?.toUpperCase() === 'I' ? false : true,
    st: snToBool(row.st),
    isento: snToBool(row.isento),
    semincidencia: snToBool(row.semincidencia),
    permitedesconto: snToBool(row.permitedesconto),
    localizacao: str(row.localizacao),
    usocontinuo: snToBool(row.usocontinuo),
    observacao: str(row.observacao),
    descontomax: num(row.descontomax),
    cest: str(row.cest),
    csticms: str(row.csosn),
    csticmsnormal: str(row.csticms),
    medfciapop: snToBool(row.medfciapop),
    qtdfciapop: num(row.qtdfciapop),
    valorfciapop: num(row.valorfciapop),
    listacontrole: str(row.listacontrole),
    idDcb: int(row.dcb),
  }
}

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
      `Não foi possível conectar ao TMS em ${url}. Verifique se o servidor está no ar.`
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
      'Resposta de IdentificacaoServidor sem Versao. Ela é necessária para autenticar no TMS.'
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

async function tmsJsonRequest(
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

export async function insertGrupoProduto(
  grupo: { codigo: string; descricao: string },
  baseUrl = DEFAULT_TMS_BASE
): Promise<BatchInsertResult> {
  return insertAuxiliaryEntity('grupo', grupo, baseUrl)
}

const AUXILIARY_TMS_PATH: Record<
  'grupo' | 'subgrupo' | 'categoria' | 'laboratorio' | 'grupodepreco' | 'similar' | 'dcb',
  string
> = {
  grupo: 'GrupoProdutoDrogaria',
  subgrupo: 'SubGrupoProdutoDrogaria',
  categoria: 'Categoria',
  laboratorio: 'Laboratorio',
  grupodepreco: 'GrupoPreco',
  similar: 'Similar',
  dcb: 'DCB',
}

export type TmsAuxiliaryEntity = keyof typeof AUXILIARY_TMS_PATH

function migrationCodigo(codigo: string): string | number {
  const codigoNum = Number(codigo)
  return Number.isInteger(codigoNum) ? codigoNum : codigo
}

export async function insertAuxiliaryEntity(
  entity: TmsAuxiliaryEntity,
  row: { codigo: string; descricao: string },
  baseUrl = DEFAULT_TMS_BASE
): Promise<BatchInsertResult> {
  const path = AUXILIARY_TMS_PATH[entity]
  const url = `${baseUrl.replace(/\/$/, '')}/tms/xdata/${path}`
  const descricao = row.descricao.trim().toLocaleUpperCase('pt-BR')
  const body = buildAuxiliaryPayload(entity, row.codigo.trim(), descricao)
  return tmsJsonRequest(url, { method: 'POST', body: JSON.stringify(body) }, baseUrl)
}

function buildAuxiliaryPayload(
  entity: TmsAuxiliaryEntity,
  codigo: string,
  descricao: string
): Record<string, unknown> {
  if (entity === 'laboratorio') {
    return { codigo_migracao: migrationCodigo(codigo), nome: descricao }
  }
  if (entity === 'similar') {
    return { descricao }
  }
  if (entity === 'dcb') {
    const padded = padDcbCode(codigo)
    const anvisa = lookupAnvisaDcb(padded)
    return { dcb: padded, descricao: anvisa?.descricao ?? descricao }
  }
  return { codigo_migracao: migrationCodigo(codigo), descricao }
}

/**
 * Envia um lote de produtos. Preferência: body com array.
 * Quando a API real fechar o contrato, ajustar só este método.
 */
export async function insertProductBatch(
  payloads: Record<string, unknown>[],
  baseUrl = DEFAULT_TMS_BASE
): Promise<BatchInsertResult> {
  const url = `${baseUrl.replace(/\/$/, '')}/tms/xdata/ProdutoService/insert`

  const body =
    payloads.length === 1
      ? payloads[0]
      : { products: payloads, items: payloads, value: payloads }

  return tmsJsonRequest(url, { method: 'POST', body: JSON.stringify(body) }, baseUrl)
}

export interface TmsDcbRecord {
  id: number | string
  dcb: string
  descricao: string
}

export async function fetchTmsDcbCatalog(
  baseUrl = DEFAULT_TMS_BASE
): Promise<Map<string, TmsDcbRecord>> {
  const catalog = new Map<string, TmsDcbRecord>()
  const pageSize = 2000
  let skip = 0

  while (true) {
    const url = `${baseUrl.replace(/\/$/, '')}/tms/xdata/DCB?$top=${pageSize}&$skip=${skip}`

    const result = await tmsJsonRequest(url, { method: 'GET' }, baseUrl)
    if (!result.ok) {
      throw new Error(result.message || 'Falha ao listar DCBs no TMS')
    }

    let parsed: unknown = null
    try {
      parsed = result.message ? JSON.parse(result.message) : null
    } catch {
      parsed = null
    }

    const rows = extractDcbRows(parsed)
    for (const row of rows) {
      const padded = padDcbCode(row.dcb)
      if (padded) catalog.set(padded, row)
      const raw = String(row.dcb ?? '').trim()
      if (raw) catalog.set(raw, row)
    }

    if (rows.length < pageSize) break
    skip += pageSize
  }

  return catalog
}

function extractDcbRows(payload: unknown): TmsDcbRecord[] {
  if (!payload || typeof payload !== 'object') return []
  const obj = payload as Record<string, unknown>
  const list = Array.isArray(obj.value)
    ? obj.value
    : Array.isArray(payload)
      ? payload
      : []

  const out: TmsDcbRecord[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const dcb = row.dcb ?? row.DCB ?? row.codigo
    if (dcb === undefined || dcb === null) continue
    out.push({
      id: (row.id as number | string) ?? '',
      dcb: String(dcb).trim(),
      descricao: String(row.descricao ?? row.nome ?? '').trim(),
    })
  }
  return out
}

export function getDefaultTmsBaseUrl() {
  return DEFAULT_TMS_BASE
}
