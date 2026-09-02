import { DEFAULT_TMS_BASE } from './tmsConfig.js'
import {
  extractODataRows,
  fetchTmsEntityRows,
  migracaoKey,
  tmsJsonRequest,
} from './tmsClient.js'
import type { BatchInsertResult } from './tmsTypes.js'

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

export function favorecidoMigracaoExists(catalog: Set<string>, value: string): boolean {
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
