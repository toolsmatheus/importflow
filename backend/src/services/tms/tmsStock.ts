import { DEFAULT_TMS_BASE } from './tmsConfig.js'
import { tmsJsonRequest } from './tmsClient.js'
import type {
  ImportacaoEstoqueDto,
  SalvarListaEstoquesResult,
} from './tmsTypes.js'

function parseResponseObject(message?: string): Record<string, unknown> | null {
  if (!message) return null
  try {
    const json = JSON.parse(message)
    if (json && typeof json === 'object' && !Array.isArray(json)) {
      return json as Record<string, unknown>
    }
  } catch {
    /* raw text */
  }
  return null
}

/**
 * Linhas `chave;quantidade` do servidor.
 * - Sucesso por EAN: "789...;16"
 * - Sucesso por IdProduto / codigo_migracao 0: "0;16" (qtd > 0) — NÃO descartar
 * - Vazio / noop: "0;0"
 */
/** @internal exported for unit tests */
export function parseKeyQtyBlock(
  raw: unknown
): Array<{ key: string; quantidade: number }> {
  const text = String(raw ?? '')
    .replace(/\\r/g, '\r')
    .replace(/\\n/g, '\n')
    .trim()
  if (!text) return []

  const lines: Array<{ key: string; quantidade: number }> = []
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const m = trimmed.match(/^([^;]*);(-?\d+(?:[.,]\d+)?)\s*$/)
    if (!m) continue
    const key = m[1].trim()
    const quantidade = Number(String(m[2]).replace(',', '.'))
    if (!Number.isFinite(quantidade) || quantidade <= 0) continue
    // chave pode ser "0" (codigo_migracao 0); só rejeita chave vazia
    if (key === '') continue
    lines.push({ key, quantidade })
  }
  return lines
}

/**
 * Importa estoque via XData (lote interno INT000 no servidor).
 * Rota: POST /tms/xdata/ImportacaoProdutoService/SalvarListaEstoques
 * Body: array de DTOS.ImportacaoEstoque.TImportacaoEstoqueDTO
 *
 * Resposta típica:
 * - { "Importado": "ean;qtd" } ou { "Importado": "0;qtd" } (migração 0 / IdProduto) — incluído
 * - { "NaoImportadoControlado": "ean;qtd" } — controlado (ignorar)
 * - { "NaoImportado": "ean;qtd" } — rejeitado pela regra do destino
 */
export async function salvarListaEstoques(
  items: ImportacaoEstoqueDto[],
  baseUrl = DEFAULT_TMS_BASE
): Promise<SalvarListaEstoquesResult> {
  if (!items.length) {
    return {
      ok: true,
      outcome: 'imported',
      imported: 0,
      message: '{"Importado":"0;0"}',
    }
  }

  const root = baseUrl.replace(/\/$/, '')
  const body = JSON.stringify(
    items.map((item) => ({
      '@xdata.type': 'DTOS.ImportacaoEstoque.TImportacaoEstoqueDTO',
      QuantidadeEstoque: Math.trunc(item.QuantidadeEstoque),
      IsCodigoBarra: item.IsCodigoBarra,
      IdFilial: item.IdFilial,
      ...(item.CodigoBarras !== undefined ? { CodigoBarras: item.CodigoBarras } : {}),
      ...(item.IdProduto !== undefined ? { IdProduto: item.IdProduto } : {}),
      ...(item.CodigoMigracao !== undefined
        ? { CodigoMigracao: Math.trunc(item.CodigoMigracao) }
        : {}),
      ...(item.Lote !== undefined ? { Lote: item.Lote } : {}),
      ...(item.Validade !== undefined ? { Validade: item.Validade } : {}),
      ...(item.Fabricacao !== undefined ? { Fabricacao: item.Fabricacao } : {}),
      ...(item.RegistroMS !== undefined ? { RegistroMS: item.RegistroMS } : {}),
    }))
  )

  const result = await tmsJsonRequest(
    `${root}/tms/xdata/ImportacaoProdutoService/SalvarListaEstoques`,
    { method: 'POST', body },
    baseUrl
  )

  if (!result.ok) {
    return { ...result, outcome: 'http_error' }
  }

  const payload = parseResponseObject(result.message)
  const importedLines = parseKeyQtyBlock(payload?.Importado ?? payload?.importado)
  if (importedLines.length > 0) {
    return {
      ...result,
      ok: true,
      outcome: 'imported',
      imported: importedLines.length,
    }
  }

  const controlledLines = parseKeyQtyBlock(
    payload?.NaoImportadoControlado ?? payload?.naoImportadoControlado
  )
  if (controlledLines.length > 0) {
    return {
      ...result,
      ok: true,
      outcome: 'skipped_controlled',
      imported: 0,
      message: result.message,
    }
  }

  const notImportedLines = parseKeyQtyBlock(
    payload?.NaoImportado ?? payload?.naoImportado
  )
  if (notImportedLines.length > 0) {
    return {
      ...result,
      ok: true,
      outcome: 'skipped_not_imported',
      imported: 0,
      message: result.message,
    }
  }

  return {
    ...result,
    ok: false,
    outcome: 'not_imported',
    imported: 0,
    message:
      'SalvarListaEstoques não confirmou inclusão. ' + (result.message ?? ''),
  }
}
