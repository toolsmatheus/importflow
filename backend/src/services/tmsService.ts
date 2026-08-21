import { parseBrazilianNumber, isBlank } from '../utils/productFormats.js'

const DEFAULT_TMS_BASE = process.env.TMS_BASE_URL ?? 'http://localhost:2001'

export interface ServerIdentification {
  idFilial: number
  raw: unknown
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

function extractIdFilial(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null
  const obj = payload as Record<string, unknown>

  const direct = obj.IdFilial ?? obj.idFilial ?? obj.id_filial ?? obj.IDFILIAL
  if (typeof direct === 'number') return direct
  if (typeof direct === 'string' && /^\d+$/.test(direct)) return Number(direct)

  for (const key of ['value', 'result', 'Result', 'Value', 'dados']) {
    const nested = obj[key]
    const found = extractIdFilial(nested)
    if (found !== null) return found
  }

  return null
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

  return { idFilial, raw: data }
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

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return {
        ok: false,
        statusCode: response.status,
        message: text || `HTTP ${response.status}`,
      }
    }

    return { ok: true, statusCode: response.status }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : 'Falha de rede ao chamar ProdutoService/insert',
    }
  }
}

export function getDefaultTmsBaseUrl() {
  return DEFAULT_TMS_BASE
}
