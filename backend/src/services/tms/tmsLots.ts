import { DEFAULT_TMS_BASE } from './tmsConfig.js'
import { extractODataRows, tmsJsonRequest } from './tmsClient.js'
import type { BatchInsertResult, InsertLoteMedicamentoInput } from './tmsTypes.js'

/**
 * Resolve id de RegistroMS pelo código (string do CSV / produto.registroMS).
 */
export async function findRegistroMsId(
  registroMs: string,
  baseUrl = DEFAULT_TMS_BASE
): Promise<number | undefined> {
  const code = registroMs.trim()
  if (!code) return undefined
  const root = baseUrl.replace(/\/$/, '')
  const filter = encodeURIComponent(`registroMS eq '${code.replace(/'/g, "''")}'`)
  const result = await tmsJsonRequest(
    `${root}/tms/xdata/RegistroMS?$filter=${filter}&$top=5`,
    { method: 'GET' },
    baseUrl
  )
  if (!result.ok || !result.message) return undefined
  try {
    const rows = extractODataRows(JSON.parse(result.message))
    for (const row of rows) {
      const id = Number(row.id)
      if (Number.isFinite(id)) return id
    }
  } catch {
    /* ignore */
  }
  return undefined
}

/**
 * Busca LoteMedicamento por produto + número do lote.
 */
export async function findLoteMedicamento(
  produtoId: number,
  lote: string,
  baseUrl = DEFAULT_TMS_BASE
): Promise<{ id: number; quantidade: number; quantidadeInicial: number } | null> {
  const root = baseUrl.replace(/\/$/, '')
  const safeLote = lote.replace(/'/g, "''")
  const filter = encodeURIComponent(
    `produto/id eq ${produtoId} and lote eq '${safeLote}'`
  )
  const result = await tmsJsonRequest(
    `${root}/tms/xdata/LoteMedicamento?$filter=${filter}&$top=1`,
    { method: 'GET' },
    baseUrl
  )
  if (!result.ok || !result.message) return null
  try {
    const rows = extractODataRows(JSON.parse(result.message))
    const row = rows[0]
    if (!row) return null
    const id = Number(row.id)
    if (!Number.isFinite(id)) return null
    return {
      id,
      quantidade: Number(row.quantidade) || 0,
      quantidadeInicial: Number(row.quantidadeInicial) || 0,
    }
  } catch {
    return null
  }
}

/**
 * Cria lote de medicamento controlado.
 * Rota: POST /tms/xdata/LoteMedicamento
 * Depois: LoteMovimento (kardex) + ExecuteSQL para gravar `quantidade`
 * (XData ignora escrita em `quantidade`; só `quantidadeInicial` entra no POST).
 */
export async function insertLoteMedicamento(
  data: InsertLoteMedicamentoInput,
  baseUrl = DEFAULT_TMS_BASE
): Promise<BatchInsertResult & { id?: number }> {
  const root = baseUrl.replace(/\/$/, '')
  const qtd = Math.trunc(data.quantidade)
  if (!Number.isFinite(qtd) || qtd <= 0) {
    return { ok: false, message: 'quantidade do lote deve ser inteiro > 0' }
  }

  let registroMsId = data.registroMsId
  if (registroMsId === undefined && data.registroMs) {
    registroMsId = await findRegistroMsId(data.registroMs, baseUrl)
  }

  const body: Record<string, unknown> = {
    '@xdata.type': 'XData.Default.LoteMedicamento',
    lote: data.lote.trim(),
    quantidadeInicial: qtd,
    fabricacao: data.fabricacao,
    validade: data.validade,
    isInterno: false,
    idFilial: data.idFilial,
    produto: { id: data.produtoId },
  }
  if (registroMsId !== undefined) {
    body.registroMS = { id: registroMsId }
  }

  const result = await tmsJsonRequest(
    `${root}/tms/xdata/LoteMedicamento`,
    { method: 'POST', body: JSON.stringify(body) },
    baseUrl
  )
  if (!result.ok) return result

  let id: number | undefined
  if (result.message) {
    try {
      const json = JSON.parse(result.message) as { id?: number }
      const parsed = Number(json.id)
      if (Number.isFinite(parsed)) id = parsed
    } catch {
      /* raw */
    }
  }
  if (id === undefined) {
    return {
      ok: false,
      statusCode: result.statusCode,
      message: 'LoteMedicamento criado sem id na resposta',
    }
  }

  // Kardex (mesmo origem do SalvarListaEstoques em INT000)
  const mov = await tmsJsonRequest(
    `${root}/tms/xdata/LoteMovimento`,
    {
      method: 'POST',
      body: JSON.stringify({
        '@xdata.type': 'XData.Default.LoteMovimento',
        data: new Date().toISOString().slice(0, 19),
        quantidade: qtd,
        saldoAnterior: 0,
        saldoAtual: qtd,
        origem: 'omlImportacaoProduto',
        cancelamento: false,
        idFilial: data.idFilial,
        'lote@xdata.ref': `LoteMedicamento(${id})`,
      }),
    },
    baseUrl
  )
  if (!mov.ok) {
    return {
      ok: false,
      statusCode: mov.statusCode,
      message:
        `Lote id=${id} criado, mas falha no LoteMovimento: ` +
        (mov.message || 'erro desconhecido'),
      id,
    }
  }

  // XData não persiste `quantidade` no POST/PATCH — atualiza via SQL do servidor.
  const qty = await setLoteMedicamentoQuantidade(id, qtd, baseUrl)
  if (!qty.ok) {
    return {
      ok: false,
      statusCode: qty.statusCode,
      message:
        `Lote id=${id} e movimento ok, mas falha ao gravar quantidade: ` +
        (qty.message || 'erro desconhecido'),
      id,
    }
  }

  return { ...result, ok: true, id }
}

/**
 * Grava LoteMedicamento.quantidade (coluna ignorada pelo XData no POST/PATCH).
 * Rota: POST /tms/xdata/ServerToolsService/ExecuteSQL
 */
export async function setLoteMedicamentoQuantidade(
  loteId: number,
  quantidade: number,
  baseUrl = DEFAULT_TMS_BASE
): Promise<BatchInsertResult> {
  const id = Math.trunc(loteId)
  const qtd = Math.trunc(quantidade)
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, message: 'id de lote inválido' }
  }
  if (!Number.isFinite(qtd) || qtd < 0) {
    return { ok: false, message: 'quantidade inválida' }
  }
  const root = baseUrl.replace(/\/$/, '')
  // ids/qtd só numéricos — sem interpolar strings do CSV
  const sql = `UPDATE lotemedicamento SET quantidade = ${qtd} WHERE id = ${id}`
  return tmsJsonRequest(
    `${root}/tms/xdata/ServerToolsService/ExecuteSQL`,
    { method: 'POST', body: JSON.stringify({ Sql: sql }) },
    baseUrl
  )
}
