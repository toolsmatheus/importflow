import { createHash } from 'crypto'
import {
  lookupAnvisaDcb,
  lookupAnvisaDcbByDescricao,
  padDcbCode,
} from './dcbIndexService.js'
import type { ProductLookupCatalogs } from './productTmsMapper.js'

export type { ProductLookupCatalogs } from './productTmsMapper.js'
export { mapCsvRowToProductPayload } from './productTmsMapper.js'

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
    // codigo do auxiliar é id local; o código Anvisa vem da descrição.
    const byName = lookupAnvisaDcbByDescricao(descricao)
    if (byName) {
      return { dcb: byName.dcb, descricao: byName.descricao.toLocaleUpperCase('pt-BR') }
    }
    const padded = padDcbCode(codigo)
    const byCode = lookupAnvisaDcb(padded)
    if (byCode) {
      return { dcb: byCode.dcb, descricao: byCode.descricao.toLocaleUpperCase('pt-BR') }
    }
    return { dcb: padded, descricao }
  }
  return { codigo_migracao: migrationCodigo(codigo), descricao }
}

/** Entidades auxiliares que usam codigo_migracao para deduplicar. */
export const AUXILIARY_MIGRACAO_ENTITIES = [
  'grupo',
  'subgrupo',
  'categoria',
  'laboratorio',
  'grupodepreco',
] as const satisfies readonly TmsAuxiliaryEntity[]

export type AuxiliaryMigracaoEntity = (typeof AUXILIARY_MIGRACAO_ENTITIES)[number]

export interface AuxiliaryExistenceCatalogs {
  /** codigo_migracao (string) → já existe no TMS */
  byMigracao: Record<AuxiliaryMigracaoEntity, Set<string>>
  /** Similar não tem codigo_migracao — deduplica por descrição UPPER */
  similarByDescricao: Set<string>
}

function addMigracaoKeys(set: Set<string>, value: unknown) {
  if (value === undefined || value === null || value === '') return
  const raw = String(value).trim()
  if (!raw) return
  set.add(raw)
  const n = Number(raw)
  if (Number.isInteger(n)) set.add(String(n))
}

/**
 * Catálogos para pular auxiliares já cadastrados (codigo_migracao / descrição similar).
 */
export async function fetchAuxiliaryExistenceCatalogs(
  baseUrl = DEFAULT_TMS_BASE
): Promise<AuxiliaryExistenceCatalogs> {
  const byMigracao: Record<AuxiliaryMigracaoEntity, Set<string>> = {
    grupo: new Set(),
    subgrupo: new Set(),
    categoria: new Set(),
    laboratorio: new Set(),
    grupodepreco: new Set(),
  }

  const loads = AUXILIARY_MIGRACAO_ENTITIES.map(async (entity) => {
    const rows = await fetchTmsEntityRows(AUXILIARY_TMS_PATH[entity], baseUrl)
    const set = byMigracao[entity]
    for (const row of rows) {
      addMigracaoKeys(set, row.codigo_migracao)
    }
  })

  const similarPromise = fetchTmsEntityRows(AUXILIARY_TMS_PATH.similar, baseUrl)
  const [, similarRows] = await Promise.all([Promise.all(loads), similarPromise])

  const similarByDescricao = new Set<string>()
  for (const row of similarRows) {
    const descricao = String(row.descricao ?? '')
      .trim()
      .toLocaleUpperCase('pt-BR')
    if (descricao) similarByDescricao.add(descricao)
  }

  return { byMigracao, similarByDescricao }
}

export function auxiliaryMigracaoExists(
  catalogs: AuxiliaryExistenceCatalogs,
  entity: AuxiliaryMigracaoEntity,
  codigo: string
): boolean {
  const set = catalogs.byMigracao[entity]
  const raw = codigo.trim()
  if (set.has(raw)) return true
  const n = Number(raw)
  if (Number.isInteger(n) && set.has(String(n))) return true
  return false
}

export function markAuxiliaryMigracaoExists(
  catalogs: AuxiliaryExistenceCatalogs,
  entity: AuxiliaryMigracaoEntity,
  codigo: string
) {
  addMigracaoKeys(catalogs.byMigracao[entity], codigo)
}

/**
 * Insere um produto: tenta ProdutoService/insert; se falhar, tenta /save.
 */
export async function insertProduct(
  payload: Record<string, unknown>,
  baseUrl = DEFAULT_TMS_BASE
): Promise<BatchInsertResult> {
  const root = baseUrl.replace(/\/$/, '')
  const body = JSON.stringify(payload)

  const insertResult = await tmsJsonRequest(
    `${root}/tms/xdata/ProdutoService/insert`,
    { method: 'POST', body },
    baseUrl
  )
  if (insertResult.ok) return insertResult

  const saveResult = await tmsJsonRequest(
    `${root}/tms/xdata/ProdutoService/save`,
    { method: 'POST', body },
    baseUrl
  )
  if (saveResult.ok) return saveResult

  return {
    ok: false,
    statusCode: saveResult.statusCode ?? insertResult.statusCode,
    message:
      saveResult.message ||
      insertResult.message ||
      'Falha no insert/save do produto',
  }
}

/** @deprecated use insertProduct — mantido para compatibilidade de imports. */
export async function insertProductBatch(
  payloads: Record<string, unknown>[],
  baseUrl = DEFAULT_TMS_BASE
): Promise<BatchInsertResult> {
  if (payloads.length === 0) return { ok: true }
  if (payloads.length === 1) return insertProduct(payloads[0], baseUrl)

  for (const payload of payloads) {
    const result = await insertProduct(payload, baseUrl)
    if (!result.ok) return result
  }
  return { ok: true }
}

export interface TmsDcbRecord {
  id: number | string
  dcb: string
  descricao: string
}

function extractODataRows(payload: unknown): Record<string, unknown>[] {
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

function extractCreatedEntityId(payloadText: string | undefined): number | null {
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

function formatAliquotaDescricao(aliquota: number): string {
  const label = Number.isInteger(aliquota)
    ? String(aliquota)
    : String(aliquota).replace('.', ',')
  return `ALIQUOTA ${label}%`
}

/**
 * Insere AliquotaICMS tipICMS/alSAIDA para o percentual informado.
 */
export async function insertAliquotaIcms(
  aliquota: number,
  baseUrl = DEFAULT_TMS_BASE
): Promise<{ ok: boolean; id?: number; message?: string }> {
  if (!Number.isFinite(aliquota) || aliquota === 0) {
    return { ok: false, message: 'Percentual de alíquota inválido para insert' }
  }

  const root = baseUrl.replace(/\/$/, '')
  const body = JSON.stringify({
    ativo: true,
    descricao: formatAliquotaDescricao(aliquota),
    tipoaliquota: 'alSAIDA',
    tipoImposto: 'tipICMS',
    aliquota,
    aliquotaisento: -1,
    aliquotaNaoConsumidorFinal: 0,
  })

  const result = await tmsJsonRequest(
    `${root}/tms/xdata/AliquotaICMS`,
    { method: 'POST', body },
    baseUrl
  )
  if (!result.ok) {
    return { ok: false, message: result.message || 'Falha ao inserir AliquotaICMS' }
  }

  let id = extractCreatedEntityId(result.message)
  if (id === null) {
    const filterUrl =
      `${root}/tms/xdata/AliquotaICMS` +
      `?$filter=aliquota eq ${aliquota} and tipoImposto eq 'tipICMS'&$top=5`
    const lookup = await tmsJsonRequest(filterUrl, { method: 'GET' }, baseUrl)
    if (lookup.ok && lookup.message) {
      try {
        const parsed = JSON.parse(lookup.message) as unknown
        for (const row of extractODataRows(parsed)) {
          if (Number(row.aliquota) !== aliquota) continue
          if (String(row.tipoImposto ?? '') !== 'tipICMS') continue
          const found = Number(row.id)
          if (Number.isFinite(found)) {
            id = found
            break
          }
        }
      } catch {
        /* ignore */
      }
    }
  }

  if (id === null) {
    return {
      ok: false,
      message: `AliquotaICMS ${aliquota}% inserida, mas o id não foi retornado`,
    }
  }

  return { ok: true, id }
}

/**
 * Garante que o percentual existe no catálogo (insere no TMS se faltar).
 */
export async function ensureAliquotaPercent(
  catalogs: ProductLookupCatalogs,
  aliquota: number,
  baseUrl = DEFAULT_TMS_BASE
): Promise<{ ok: boolean; id?: number; message?: string; inserted?: boolean }> {
  if (!Number.isFinite(aliquota)) {
    return { ok: false, message: 'aliquota inválida' }
  }
  if (aliquota === 0) {
    return { ok: true }
  }

  const existing = catalogs.aliquotaByPercent.get(aliquota)
  if (existing !== undefined && existing > 0) {
    return { ok: true, id: existing, inserted: false }
  }

  if (existing === -1) {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 100))
      const waited = catalogs.aliquotaByPercent.get(aliquota)
      if (waited !== undefined && waited > 0) {
        return { ok: true, id: waited, inserted: false }
      }
      if (waited === undefined) break
    }
  }

  catalogs.aliquotaByPercent.set(aliquota, -1)
  const inserted = await insertAliquotaIcms(aliquota, baseUrl)
  if (!inserted.ok || inserted.id === undefined) {
    catalogs.aliquotaByPercent.delete(aliquota)
    return { ok: false, message: inserted.message || 'Falha ao criar alíquota' }
  }

  catalogs.aliquotaByPercent.set(aliquota, inserted.id)
  return { ok: true, id: inserted.id, inserted: true }
}

/**
 * Insere um código de barras adicional no produto.
 * Rota: POST /tms/xdata/Produto({id})/listacodigobarras
 */
export async function insertCodigoBarraProduto(
  produtoId: number,
  data: { codigoBarra: string; fator?: number },
  baseUrl = DEFAULT_TMS_BASE
): Promise<BatchInsertResult> {
  const root = baseUrl.replace(/\/$/, '')
  const fator = data.fator ?? 1
  const body = JSON.stringify({
    '@xdata.type': 'XData.Default.CodigoBarraProduto',
    codigoBarra: data.codigoBarra.trim(),
    fator,
  })
  return tmsJsonRequest(
    `${root}/tms/xdata/Produto(${produtoId})/listacodigobarras`,
    { method: 'POST', body },
    baseUrl
  )
}

/** Lista códigos de barras adicionais já cadastrados (CodigoBarraProduto). */
export async function fetchCodigoBarraProdutoRows(
  baseUrl = DEFAULT_TMS_BASE
): Promise<Array<{ id: number; codigoBarra: string; fator: number }>> {
  const rows = await fetchTmsEntityRows('CodigoBarraProduto', baseUrl)
  const out: Array<{ id: number; codigoBarra: string; fator: number }> = []
  for (const row of rows) {
    const id = Number(row.id)
    const codigoBarra = String(row.codigoBarra ?? '').trim()
    if (!Number.isFinite(id) || !codigoBarra) continue
    out.push({
      id,
      codigoBarra,
      fator: Number(row.fator) || 0,
    })
  }
  return out
}

/**
 * Insere código do fornecedor no produto.
 * Rota: POST /tms/xdata/Produto({id})/listacodigofornecedores
 * Campos: codigo (= código do produto no fornecedor), fatorCompra, favorecido (codigo_migracao).
 */
export async function insertCodigoFornecedor(
  produtoId: number,
  data: { codigo: string; fatorCompra?: number; favorecidoMigracao: number },
  baseUrl = DEFAULT_TMS_BASE
): Promise<BatchInsertResult> {
  const root = baseUrl.replace(/\/$/, '')
  const fatorCompra =
    data.fatorCompra !== undefined && Number.isFinite(data.fatorCompra)
      ? Math.trunc(data.fatorCompra)
      : 1
  const body = JSON.stringify({
    '@xdata.type': 'XData.Default.CodigoFornecedor',
    codigo: data.codigo.trim(),
    fatorCompra,
    favorecido: { codigo_migracao: data.favorecidoMigracao },
  })
  return tmsJsonRequest(
    `${root}/tms/xdata/Produto(${produtoId})/listacodigofornecedores`,
    { method: 'POST', body },
    baseUrl
  )
}

/** codigo_migracao de favorecido/fornecedor cadastrados no banco. */
export async function fetchFavorecidoMigracaoKeys(baseUrl = DEFAULT_TMS_BASE): Promise<Set<string>> {
  const rows = await fetchTmsEntityRows('Favorecido', baseUrl)
  const keys = new Set<string>()
  for (const row of rows) {
    const key = migracaoKey(row.codigo_migracao)
    if (key === null) continue
    keys.add(key)
    const asNum = String(Number(key))
    if (asNum !== 'NaN') keys.add(asNum)
  }
  return keys
}

function favorecidoMigracaoExists(catalog: Set<string>, value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (catalog.has(trimmed)) return true
  const asNum = String(Number(trimmed))
  return asNum !== 'NaN' && catalog.has(asNum)
}

export function parseFavorecidoMigracao(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  if (!Number.isInteger(n)) return null
  return n
}

/** Chaves produto+fornecedor+código já cadastradas: `${codigo_migracao}|${codigo}`. */
export async function fetchProductCodigoFornecedorKeys(
  produtoId: number,
  baseUrl = DEFAULT_TMS_BASE
): Promise<Set<string>> {
  const root = baseUrl.replace(/\/$/, '')
  const listResult = await tmsJsonRequest(
    `${root}/tms/xdata/Produto(${produtoId})/listacodigofornecedores`,
    { method: 'GET' },
    baseUrl
  )
  if (!listResult.ok) return new Set()

  let listParsed: unknown = null
  try {
    listParsed = listResult.message ? JSON.parse(listResult.message) : null
  } catch {
    return new Set()
  }

  const keys = new Set<string>()
  for (const row of extractODataRows(listParsed)) {
    const id = Number(row.id)
    const codigo = String(row.codigo ?? '').trim()
    if (!Number.isFinite(id) || !codigo) continue

    const detailResult = await tmsJsonRequest(
      `${root}/tms/xdata/CodigoFornecedor(${id})?$expand=favorecido`,
      { method: 'GET' },
      baseUrl
    )
    if (!detailResult.ok) continue

    let detail: Record<string, unknown> | null = null
    try {
      detail = detailResult.message ? JSON.parse(detailResult.message) : null
    } catch {
      continue
    }

    const favorecido = detail?.favorecido as Record<string, unknown> | undefined
    const favMigracao = migracaoKey(favorecido?.codigo_migracao)
    keys.add(favMigracao ? `${favMigracao}|${codigo}` : `|${codigo}`)
  }

  return keys
}

export { favorecidoMigracaoExists }

async function fetchTmsEntityRows(
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

function migracaoKey(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  return String(value).trim()
}

function buildMigracaoMap(rows: Record<string, unknown>[]): Map<string, number> {
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

/**
 * Carrega catálogos necessários para resolver refs do produto.
 * `similarAux` / `dcbAux` = linhas dos CSV auxiliares (codigo → descrição).
 */
export async function fetchProductLookupCatalogs(
  baseUrl = DEFAULT_TMS_BASE,
  similarAux: Array<{ codigo: string; descricao: string }> = [],
  dcbAux: Array<{ codigo: string; descricao: string }> = []
): Promise<ProductLookupCatalogs> {
  const [
    grupos,
    subgrupos,
    categorias,
    laboratorios,
    gruposPreco,
    similares,
    aliquotas,
    unidades,
    cfops,
    dcbs,
  ] = await Promise.all([
    fetchTmsEntityRows('GrupoProdutoDrogaria', baseUrl),
    fetchTmsEntityRows('SubGrupoProdutoDrogaria', baseUrl),
    fetchTmsEntityRows('Categoria', baseUrl),
    fetchTmsEntityRows('Laboratorio', baseUrl),
    fetchTmsEntityRows('GrupoPreco', baseUrl),
    fetchTmsEntityRows('Similar', baseUrl),
    fetchTmsEntityRows('AliquotaICMS', baseUrl),
    fetchTmsEntityRows('Unidade', baseUrl),
    fetchTmsEntityRows('CFOP', baseUrl, 500),
    fetchTmsEntityRows('DCB', baseUrl),
  ])

  const similarByDescricao = new Map<string, number>()
  for (const row of similares) {
    const id = Number(row.id)
    if (!Number.isFinite(id)) continue
    const descricao = String(row.descricao ?? '')
      .trim()
      .toLocaleUpperCase('pt-BR')
    if (descricao) similarByDescricao.set(descricao, id)
  }

  const similarCodigoToDescricao = new Map<string, string>()
  for (const item of similarAux) {
    const codigo = item.codigo.trim()
    const descricao = item.descricao.trim().toLocaleUpperCase('pt-BR')
    if (codigo && descricao) similarCodigoToDescricao.set(codigo, descricao)
  }

  const dcbByCode = new Map<string, number>()
  const dcbByDescricao = new Map<string, number>()
  for (const row of dcbs) {
    const id = Number(row.id)
    if (!Number.isFinite(id)) continue
    const dcb = String(row.dcb ?? '').trim()
    if (dcb) {
      dcbByCode.set(dcb, id)
      const padded = padDcbCode(dcb)
      if (padded) dcbByCode.set(padded, id)
    }
    const descricao = String(row.descricao ?? '')
      .trim()
      .toLocaleUpperCase('pt-BR')
    if (!descricao) continue
    // Preferir códigos Anvisa limpos (5 dígitos) e descrições sem lixo.
    const existing = dcbByDescricao.get(descricao)
    if (existing === undefined) {
      dcbByDescricao.set(descricao, id)
      continue
    }
    const padded = padDcbCode(dcb)
    const isClean = /^\d{5}$/.test(padded) && !/[|"']/.test(descricao)
    if (isClean) dcbByDescricao.set(descricao, id)
  }

  const dcbCodigoToDescricao = new Map<string, string>()
  for (const item of dcbAux) {
    const codigo = item.codigo.trim()
    const descricao = item.descricao.trim().toLocaleUpperCase('pt-BR')
    if (codigo && descricao) dcbCodigoToDescricao.set(codigo, descricao)
  }

  let unidadeUnId = 600
  for (const row of unidades) {
    if (String(row.unidade ?? '').trim().toUpperCase() === 'UN') {
      const id = Number(row.id)
      if (Number.isFinite(id)) {
        unidadeUnId = id
        break
      }
    }
  }

  const aliquotaByPercent = new Map<number, number>()
  let aliquotaStId = 100
  let aliquotaIsentoId = 400

  for (const row of aliquotas) {
    const id = Number(row.id)
    if (!Number.isFinite(id)) continue
    const tipoImposto = String(row.tipoImposto ?? '')
    const aliquota = Number(row.aliquota)
    const descricao = String(row.descricao ?? '').toUpperCase()
    const aliquotaisento = Number(row.aliquotaisento)

    if (tipoImposto === 'tipICMS' && Number.isFinite(aliquota) && aliquota !== 0) {
      if (!aliquotaByPercent.has(aliquota)) {
        aliquotaByPercent.set(aliquota, id)
      }
    }

    if (
      tipoImposto === 'tipICMS' &&
      aliquota === 0 &&
      (descricao.includes('SUBSTITU') || aliquotaisento === 0)
    ) {
      aliquotaStId = id
    }
    if (
      tipoImposto === 'tipICMS' &&
      aliquota === 0 &&
      (descricao.includes('ISENTO') || aliquotaisento === 1)
    ) {
      aliquotaIsentoId = id
    }
  }

  const cfopByCode = new Map<string, number>()
  const cfopCandidates = new Map<string, Array<{ id: number; score: number }>>()
  for (const row of cfops) {
    const id = Number(row.id)
    const cfop = String(row.cfop ?? '').trim()
    if (!Number.isFinite(id) || !cfop) continue
    const descricao = String(row.descricao ?? '').trim()
    const score = (descricao ? 1000 : 0) - id
    const list = cfopCandidates.get(cfop) ?? []
    list.push({ id, score })
    cfopCandidates.set(cfop, list)
  }
  for (const [cfop, list] of cfopCandidates) {
    list.sort((a, b) => b.score - a.score)
    cfopByCode.set(cfop, list[0].id)
  }

  return {
    grupoByMigracao: buildMigracaoMap(grupos),
    subgrupoByMigracao: buildMigracaoMap(subgrupos),
    categoriaByMigracao: buildMigracaoMap(categorias),
    laboratorioByMigracao: buildMigracaoMap(laboratorios),
    grupodeprecoByMigracao: buildMigracaoMap(gruposPreco),
    similarByDescricao,
    similarCodigoToDescricao,
    dcbByCode,
    dcbByDescricao,
    dcbCodigoToDescricao,
    unidadeUnId,
    aliquotaByPercent,
    aliquotaStId,
    aliquotaIsentoId,
    cfopByCode,
  }
}

export async function fetchTmsDcbCatalog(
  baseUrl = DEFAULT_TMS_BASE
): Promise<Map<string, TmsDcbRecord>> {
  const catalog = new Map<string, TmsDcbRecord>()
  const rows = await fetchTmsEntityRows('DCB', baseUrl)

  for (const row of rows) {
    const dcb = row.dcb ?? row.DCB ?? row.codigo
    if (dcb === undefined || dcb === null) continue
    const record: TmsDcbRecord = {
      id: (row.id as number | string) ?? '',
      dcb: String(dcb).trim(),
      descricao: String(row.descricao ?? row.nome ?? '').trim(),
    }
    const padded = padDcbCode(record.dcb)
    if (padded) catalog.set(padded, record)
    if (record.dcb) catalog.set(record.dcb, record)
  }

  return catalog
}

/** Códigos de barras e codigo_migracao já presentes em Produto no TMS. */
export interface ProductExistenceCatalogs {
  /** codigoBarras → id do produto TMS */
  byBarcode: Map<string, number>
  /** codigo_migracao → id do produto TMS */
  byMigracao: Map<string, number>
}

function addExistenceKey(map: Map<string, number>, key: unknown, id: number) {
  if (key === undefined || key === null) return
  const raw = String(key).trim()
  if (!raw) return
  if (!map.has(raw)) map.set(raw, id)
  const n = Number(raw)
  if (Number.isInteger(n) && !map.has(String(n))) map.set(String(n), id)
}

export async function fetchProductExistenceCatalogs(
  baseUrl = DEFAULT_TMS_BASE
): Promise<ProductExistenceCatalogs> {
  const byBarcode = new Map<string, number>()
  const byMigracao = new Map<string, number>()
  const rows = await fetchTmsEntityRows('Produto', baseUrl)

  for (const row of rows) {
    const id = Number(row.id)
    if (!Number.isFinite(id)) continue
    addExistenceKey(byBarcode, row.codigoBarras ?? row.CodigoBarras, id)
    addExistenceKey(byMigracao, row.codigo_migracao, id)
  }

  return { byBarcode, byMigracao }
}

export function getDefaultTmsBaseUrl() {
  return DEFAULT_TMS_BASE
}
