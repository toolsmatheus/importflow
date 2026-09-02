import { DEFAULT_TMS_BASE } from './tmsConfig.js'
import { tmsJsonRequest } from './tmsClient.js'
import type {
  BatchInsertResult,
  ImportarListaProdutoError,
  ImportarListaProdutosResult,
} from './tmsTypes.js'

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

/** Extrai erros por codigo_migracao da resposta de ImportarListaProdutos. */
export function parseImportarListaResponse(raw?: string): {
  itemErrors: ImportarListaProdutoError[]
  globalError?: string
} {
  if (!raw) return { itemErrors: [] }

  let text = raw
  try {
    const json = JSON.parse(raw) as { value?: unknown; error?: { message?: string } }
    if (json.error?.message) {
      return { itemErrors: [], globalError: json.error.message }
    }
    if ('value' in json) text = String(json.value ?? '')
  } catch {
    /* texto bruto */
  }

  const trimmed = text.trim()
  if (!trimmed) return { itemErrors: [] }

  const itemErrors: ImportarListaProdutoError[] = []
  for (const line of trimmed.split(/\r?\n/)) {
    const match = line.match(/Erro ao salvar cód\. migração\s+(\d+)\s*:\s*(.+)/i)
    if (match) {
      itemErrors.push({ codigoMigracao: match[1], message: match[2].trim() })
    }
  }

  if (itemErrors.length === 0 && /erro/i.test(trimmed)) {
    return { itemErrors: [], globalError: trimmed }
  }

  return { itemErrors }
}

/**
 * Importa produtos em lote via ImportacaoProdutoService/ImportarListaProdutos.
 * Body: { Produtos: TList<TProduto>, ImportarJaExistente: boolean }
 */
export async function importarListaProdutos(
  payloads: Record<string, unknown>[],
  baseUrl = DEFAULT_TMS_BASE,
  importarJaExistente = false
): Promise<ImportarListaProdutosResult> {
  if (payloads.length === 0) {
    return { ok: true, importedCount: 0, failedCount: 0, itemErrors: [] }
  }

  const root = baseUrl.replace(/\/$/, '')
  const body = JSON.stringify({
    Produtos: payloads,
    ImportarJaExistente: importarJaExistente,
  })

  const result = await tmsJsonRequest(
    `${root}/tms/xdata/ImportacaoProdutoService/ImportarListaProdutos`,
    { method: 'POST', body },
    baseUrl
  )

  const parsed = parseImportarListaResponse(result.message)

  if (!result.ok) {
    return {
      ok: false,
      statusCode: result.statusCode,
      message: parsed.globalError || result.message || 'Falha na importação em lote',
      importedCount: 0,
      failedCount: payloads.length,
      itemErrors: parsed.itemErrors,
    }
  }

  if (parsed.globalError) {
    return {
      ok: false,
      statusCode: result.statusCode,
      message: parsed.globalError,
      importedCount: 0,
      failedCount: payloads.length,
      itemErrors: parsed.itemErrors,
    }
  }

  const failedCount = parsed.itemErrors.length
  const importedCount = Math.max(0, payloads.length - failedCount)

  return {
    ok: failedCount === 0,
    statusCode: result.statusCode,
    message: result.message,
    importedCount,
    failedCount,
    itemErrors: parsed.itemErrors,
  }
}
