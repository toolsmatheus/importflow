import { parseBrazilianNumber, isBlank } from '../utils/productFormats.js'
import { lookupAnvisaDcbByDescricao, padDcbCode } from './dcbIndexService.js'

/** Catálogos TMS usados para montar refs `@xdata.ref` no insert de produto. */
export interface ProductLookupCatalogs {
  grupoByMigracao: Map<string, number>
  subgrupoByMigracao: Map<string, number>
  categoriaByMigracao: Map<string, number>
  laboratorioByMigracao: Map<string, number>
  grupodeprecoByMigracao: Map<string, number>
  /** descrição UPPER → id TMS */
  similarByDescricao: Map<string, number>
  /** código do CSV auxiliar similar → descrição */
  similarCodigoToDescricao: Map<string, string>
  /** código Anvisa DCB (padded e raw) → id TMS */
  dcbByCode: Map<string, number>
  /** descrição UPPER → id TMS (preferindo código Anvisa limpo) */
  dcbByDescricao: Map<string, number>
  /** código do CSV auxiliar dcb → descrição */
  dcbCodigoToDescricao: Map<string, string>
  unidadeUnId: number
  /** percentual ICMS (≠ 0) → id AliquotaICMS tipICMS */
  aliquotaByPercent: Map<number, number>
  aliquotaStId: number
  aliquotaIsentoId: number
  /** CFOP string → id preferido (com descrição quando houver) */
  cfopByCode: Map<string, number>
}

export interface MapProductResult {
  ok: true
  payload: Record<string, unknown>
  /** Avisos que não impedem o insert (ex.: DCB omitido em controlado). */
  warnings?: string[]
}

export interface MapProductError {
  ok: false
  message: string
}

const LISTA_PIS_COFINS_TMS: Record<string, { tipo: string; monofasico: boolean }> = {
  NEUTRA: { tipo: 'tlListaNeutra', monofasico: false },
  POSITIVA: { tipo: 'tlListaPositiva', monofasico: false },
  NEGATIVA: { tipo: 'tlListaNegativa', monofasico: false },
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

function str(value: string | undefined): string | undefined {
  if (isBlank(value)) return undefined
  return value!.trim()
}

function xdataRef(entity: string, id: number): string {
  return `${entity}(${id})`
}

function padCstDigits(raw: string, width = 2): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return raw
  return digits.padStart(width, '0')
}

/** CST PIS/COFINS no SPED é 2 dígitos; CSV legado usa 004/049. */
function normalizeCstPisCofinsDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  const n = Number(digits)
  if (!Number.isFinite(n)) return digits.slice(-2).padStart(2, '0')
  return String(n).padStart(2, '0').slice(-2)
}

function mapCstIcms(raw: string | undefined, prefix: 'cic'): string | undefined {
  const v = str(raw)
  if (!v) return undefined
  if (v.toLowerCase().startsWith(prefix)) return v
  return `${prefix}${padCstDigits(v)}`
}

/** Valores aceitos pelo enum XData `cpCstPis` / `ccCstCofins` no TMS. */
const VALID_CST_PIS_COFINS = new Set([
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '49',
  '50',
  '51',
  '52',
  '53',
  '54',
  '55',
  '56',
  '60',
  '61',
  '62',
  '63',
  '64',
  '65',
  '66',
  '67',
  '70',
  '71',
  '72',
  '73',
  '74',
  '75',
  '98',
  '99',
])

/**
 * Coluna CSV `cstpiscofins` define o mesmo CST para PIS e COFINS
 * (enums XData `cpCstPis` / `ccCstCofins`).
 */
function mapCstPisCofins(
  raw: string | undefined
): { cstpis?: string; cstcofins?: string } {
  const v = str(raw)
  if (!v) return {}
  const lower = v.toLowerCase()

  if (lower === 'cpnenhum' || lower === 'ccnenhum' || lower === 'nenhum') {
    return { cstpis: 'cpNenhum', cstcofins: 'ccNenhum' }
  }

  const digitSource =
    lower.startsWith('cp') || lower.startsWith('cc') ? lower.slice(2) : v
  const digits = normalizeCstPisCofinsDigits(digitSource)
  if (!VALID_CST_PIS_COFINS.has(digits)) return {}
  return { cstpis: `cp${digits}`, cstcofins: `cc${digits}` }
}

function mapListaControlado(raw: string | undefined): string {
  const v = str(raw)
  if (!v) return 'tlNenhuma'
  const u = v.toUpperCase()
  if (u === 'NENHUMA' || u === 'NENHUM' || u === 'TLNENHUMA') return 'tlNenhuma'
  // Antibiótico: no CSV usa-se "T", mas o enum XData não tem tlT —
  // a classe SNGPC (tcAntimicrobiano) é que marca antimicrobiano.
  if (isAntimicrobianoLista(u)) return 'tlNenhuma'
  if (u.startsWith('TL')) return `tl${u.slice(2)}`
  return `tl${u}`
}

function isAntimicrobianoLista(raw: string | undefined): boolean {
  const u = (typeof raw === 'string' ? raw : str(raw))?.toUpperCase()
  if (!u) return false
  return (
    u === 'T' ||
    u === 'TLT' ||
    u === 'ANTIMICROBIANO' ||
    u === 'ANTIMICROBIANOS' ||
    u === 'ANTIBIOTICO' ||
    u === 'ANTIBIOTICOS' ||
    u === 'ANTIBIÓTICO' ||
    u === 'ANTIBIÓTICOS'
  )
}

/** Extrai unid. por embalagem do nome (ex.: "30CP", "20 COMP"). */
function parseUnidadesPorEmbalagemFromNome(nome: string): number | undefined {
  const m = nome.match(/\b(\d+)\s*(?:CP|CPS|COMP|COMPRIMIDOS?|CAPS?|CÁPSULAS?|CAPSULES?)\b/i)
  if (!m) return undefined
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function mapUnidadeSngpc(raw: string | undefined): string {
  const v = str(raw)?.toUpperCase()
  if (!v) return 'tupCaixa'
  if (v.startsWith('TUP')) return `tup${v.slice(3)}`
  const map: Record<string, string> = {
    CAIXA: 'tupCaixa',
    CX: 'tupCaixa',
    FRASCO: 'tupFrasco',
    AMPOLA: 'tupAmpola',
    CARTELA: 'tupCartela',
    TUBO: 'tupTubo',
    ENVELOPE: 'tupEnvelope',
    NENHUM: 'tupNenhum',
    NENHUMA: 'tupNenhum',
  }
  return map[v] ?? `tup${v.charAt(0)}${v.slice(1).toLowerCase()}`
}

function resolveMigracaoId(
  code: string | undefined,
  map: Map<string, number>,
  label: string
): { id?: number; error?: string } {
  const v = str(code)
  if (!v) return {}
  const id = map.get(v) ?? map.get(String(Number(v)))
  if (id === undefined) {
    return { error: `${label} codigo_migracao=${v} não encontrado no TMS` }
  }
  return { id }
}

function resolveAliquotaId(
  row: Record<string, string>,
  catalogs: ProductLookupCatalogs
): { id?: number; error?: string } {
  const aliquota = num(row.aliquota)
  if (aliquota === undefined) {
    return { error: 'aliquota obrigatória' }
  }

  const st = str(row.st)?.toUpperCase() === 'S'
  const isento = str(row.isento)?.toUpperCase() === 'S'

  if (aliquota === 0) {
    if (st === isento) {
      return {
        error:
          'Quando aliquota=0, exatamente uma coluna (st ou isento) deve ser S',
      }
    }
    return { id: st ? catalogs.aliquotaStId : catalogs.aliquotaIsentoId }
  }

  const found = catalogs.aliquotaByPercent.get(aliquota)
  if (found !== undefined && found > 0) return { id: found }

  return {
    error: `AliquotaICMS com aliquota=${aliquota} não encontrada no TMS (deveria ter sido criada antes do produto)`,
  }
}

function resolveSimilarId(
  row: Record<string, string>,
  catalogs: ProductLookupCatalogs
): { id?: number; error?: string } {
  const code = str(row.similar)
  if (!code) return {}

  const descricao =
    catalogs.similarCodigoToDescricao.get(code) ??
    catalogs.similarCodigoToDescricao.get(String(Number(code))) ??
    code

  const key = descricao.trim().toLocaleUpperCase('pt-BR')
  const id = catalogs.similarByDescricao.get(key)
  if (id === undefined) {
    return { error: `Similar "${descricao}" não encontrado no TMS por descrição` }
  }
  return { id }
}

function resolveDcbId(
  row: Record<string, string>,
  catalogs: ProductLookupCatalogs
): { id?: number; warning?: string } {
  const code = str(row.dcb)
  if (!code) return {}

  // CSV auxiliar usa id local (ex.: 4;Clonazepam) — não é o código Anvisa.
  const auxDescricao =
    catalogs.dcbCodigoToDescricao.get(code) ??
    catalogs.dcbCodigoToDescricao.get(String(Number(code)))

  if (auxDescricao) {
    const key = auxDescricao.trim().toLocaleUpperCase('pt-BR')
    const byDesc = catalogs.dcbByDescricao.get(key)
    if (byDesc !== undefined) return { id: byDesc }

    const anvisa = lookupAnvisaDcbByDescricao(key)
    if (anvisa) {
      const id =
        catalogs.dcbByCode.get(anvisa.dcb) ?? catalogs.dcbByCode.get(padDcbCode(anvisa.dcb))
      if (id !== undefined) return { id }
      return {
        warning: `DCB "${auxDescricao}" (Anvisa ${anvisa.dcb}) não encontrado no TMS — DCB não vinculado`,
      }
    }
    return {
      warning: `DCB auxiliar ${code} (${auxDescricao}): nome não encontrado na lista Anvisa — DCB não vinculado`,
    }
  }

  const padded = padDcbCode(code)
  const byCode =
    catalogs.dcbByCode.get(padded) ??
    catalogs.dcbByCode.get(code) ??
    catalogs.dcbByCode.get(String(Number(code)))
  if (byCode !== undefined) return { id: byCode }

  const byDesc = catalogs.dcbByDescricao.get(code.toLocaleUpperCase('pt-BR'))
  if (byDesc !== undefined) return { id: byDesc }

  return { warning: `DCB ${code} não encontrado no TMS — DCB não vinculado` }
}

/**
 * Regras fiscais:
 * - aliquota ≠ 0 → CFOP 5102, csticmsnormal cic00, csticms cic102
 * - ST (st=S) → CFOP 5405, csticmsnormal cic60, csticms cic500
 * - Isento (isento=S) → csticmsnormal cic40
 */
function resolveFiscalOverrides(row: Record<string, string>): {
  cfopCode?: string
  csticms?: string
  csticmsnormal?: string
} {
  const aliquota = num(row.aliquota)
  const isSt = str(row.st)?.toUpperCase() === 'S'
  const isIsento = str(row.isento)?.toUpperCase() === 'S'

  if (aliquota !== undefined && aliquota !== 0) {
    return {
      cfopCode: '5102',
      csticmsnormal: 'cic00',
      csticms: 'cic102',
    }
  }

  if (isSt) {
    return {
      cfopCode: '5405',
      csticmsnormal: 'cic60',
      csticms: 'cic500',
    }
  }

  if (isIsento) {
    return {
      csticmsnormal: 'cic40',
    }
  }

  return {}
}

/**
 * Monta o payload XData de Produto a partir de uma linha do CSV.
 * Unidade de estoque é sempre UN. Estoque do CSV é ignorado.
 */
export function mapCsvRowToProductPayload(
  row: Record<string, string>,
  idFilial: number,
  catalogs: ProductLookupCatalogs
): MapProductResult | MapProductError {
  const nomeRaw = str(row.nome)
  if (!nomeRaw) return { ok: false, message: 'nome obrigatório' }
  const nome = nomeRaw.toLocaleUpperCase('pt-BR')

  const valorCusto = num(row.custo)
  if (valorCusto === undefined) return { ok: false, message: 'custo obrigatório' }

  const grupo = resolveMigracaoId(row.codigogrupo, catalogs.grupoByMigracao, 'Grupo')
  if (grupo.error) return { ok: false, message: grupo.error }
  if (grupo.id === undefined) return { ok: false, message: 'codigogrupo obrigatório' }

  const aliquota = resolveAliquotaId(row, catalogs)
  if (aliquota.error || aliquota.id === undefined) {
    return { ok: false, message: aliquota.error || 'aliquota inválida' }
  }

  const subgrupo = resolveMigracaoId(row.subgrupo, catalogs.subgrupoByMigracao, 'Subgrupo')
  if (subgrupo.error) return { ok: false, message: subgrupo.error }

  const categoria = resolveMigracaoId(row.categoria, catalogs.categoriaByMigracao, 'Categoria')
  if (categoria.error) return { ok: false, message: categoria.error }

  const laboratorio = resolveMigracaoId(
    row.laboratorio,
    catalogs.laboratorioByMigracao,
    'Laboratório'
  )
  if (laboratorio.error) return { ok: false, message: laboratorio.error }

  const grupodepreco = resolveMigracaoId(
    row.grupodepreco,
    catalogs.grupodeprecoByMigracao,
    'Grupo de preço'
  )
  if (grupodepreco.error) return { ok: false, message: grupodepreco.error }

  const similar = resolveSimilarId(row, catalogs)
  if (similar.error) return { ok: false, message: similar.error }

  const dcb = resolveDcbId(row, catalogs)

  const fiscal = resolveFiscalOverrides(row)
  const cfopCode = fiscal.cfopCode ?? str(row.cfop)
  let cfopId: number | undefined
  if (cfopCode) {
    cfopId = catalogs.cfopByCode.get(cfopCode)
    if (cfopId === undefined) {
      return { ok: false, message: `CFOP ${cfopCode} não encontrado no TMS` }
    }
  }

  const listaKey = str(row.listapiscofins)?.toUpperCase() ?? 'NEUTRA'
  const listaMap = LISTA_PIS_COFINS_TMS[listaKey] ?? {
    tipo: 'tlListaNeutra',
    monofasico: false,
  }

  const { cstpis, cstcofins } = mapCstPisCofins(row.cstpiscofins)
  const codigoMigracao = str(row.codigo)
  const margemLucro = num(row.markup)
  const valorvenda = num(row.venda)
  const fator = num(row.fator) ?? 1

  const payload: Record<string, unknown> = {
    '@xdata.type': 'XData.Default.Produto',
    idFilial,
    nome,
    valorCusto,
    ultimoValorCusto: valorCusto,
    ativo: str(row.ativo)?.toUpperCase() === 'I' ? false : true,
    fatordecompra: fator,
    tipoListaPisCofins: listaMap.tipo,
    monofasico: listaMap.monofasico,
    atualizarestoque: snToBool(row.atualizaestoque) ?? true,
    atualizarpreco: true,
    permitirdescontovenda: snToBool(row.permitedesconto) ?? true,
    origemmercadoria: 'omNacional',
    apresentacao: 'taCapCompDrag',
    tipopreco: 'tpLiberado',
    tipoitemsped: 'tisMercadoriaRevenda',
    listaControlado: mapListaControlado(row.listacontrole),
    listaControladoAdendo: 'tlNenhuma',
    'unidadeEstoque@xdata.ref': xdataRef('Unidade', catalogs.unidadeUnId),
    'grupo@xdata.ref': xdataRef('GrupoProdutoDrogaria', grupo.id),
    'aliquotaicms@xdata.ref': xdataRef('AliquotaICMS', aliquota.id),
  }

  if (codigoMigracao !== undefined) {
    const n = Number(codigoMigracao)
    payload.codigo_migracao = Number.isInteger(n) ? n : codigoMigracao
  }
  if (margemLucro !== undefined) payload.margemLucro = margemLucro
  if (valorvenda !== undefined) {
    payload.valorvenda = valorvenda
    payload.ultimoValorVenda = valorvenda
  }

  const codigoBarras = str(row.codigobarras)
  if (codigoBarras) payload.codigoBarras = codigoBarras

  const ncm = str(row.ncm)
  if (ncm) payload.ncm = ncm

  const cest = str(row.cest)
  if (cest) payload.CEST = cest

  const valorpmc = num(row.valorpmc)
  if (valorpmc !== undefined) payload.valorpmc = valorpmc

  const demanda = num(row.demanda)
  if (demanda !== undefined) payload.demanda = demanda

  const desconto = num(row.descontofixo)
  if (desconto !== undefined) payload.desconto = desconto

  const descontoMaximo = num(row.descontomax)
  if (descontoMaximo !== undefined) payload.descontoMaximo = descontoMaximo

  const comissao = num(row.comissao)
  if (comissao !== undefined) payload.percentualcomissao = comissao

  const usocontinuo = snToBool(row.usocontinuo)
  if (usocontinuo !== undefined) payload.usocontinuo = usocontinuo

  const observacao = str(row.observacao)
  if (observacao) payload.observacaovenda = observacao

  const csticms = fiscal.csticms ?? mapCstIcms(row.csosn, 'cic')
  if (csticms) payload.csticms = csticms

  const csticmsnormal = fiscal.csticmsnormal ?? mapCstIcms(row.csticms, 'cic')
  if (csticmsnormal) payload.csticmsnormal = csticmsnormal

  if (cstpis) payload.cstpis = cstpis
  if (cstcofins) payload.cstcofins = cstcofins

  const medPop = snToBool(row.medfciapop)
  if (medPop !== undefined) payload.medicamentofarmaciapopular = medPop
  const qtdPop = num(row.qtdfciapop)
  if (qtdPop !== undefined) payload.quantidadefarmaciapopular = qtdPop
  const valorPop = num(row.valorfciapop)
  if (valorPop !== undefined) {
    payload.valorfarmaciapopular = valorPop
    payload.valorfinalfarmaciapopular = valorPop
  }

  const listaControleRaw = str(row.listacontrole)
  const isControlado = Boolean(listaControleRaw)
  const warnings: string[] = []
  if (dcb.warning) {
    warnings.push(dcb.warning)
  }

  if (isControlado) {
    payload.controlaLote = true
    payload.dataInicioControlado = new Date().toISOString().slice(0, 19)
    // Antibiótico (lista T) → ANTIMICROBIANO; demais listas → CONTROLE ESPECIAL
    payload.tipoclassesngpc = isAntimicrobianoLista(listaControleRaw)
      ? 'tcAntimicrobiano'
      : 'tcControleEspecial'
    // Unidade SNGPC: CSV opcional ou CAIXA por padrão
    payload.unidadesngpc = mapUnidadeSngpc(row.unidadesngpc)
    // Unid. por embalagem: coluna opcional, senão tenta extrair do nome (ex.: 30CP)
    const unidEmb =
      num(row.unidemb) ??
      num(row.unidadesporembalagem) ??
      parseUnidadesPorEmbalagemFromNome(nome)
    if (unidEmb !== undefined) {
      payload.unidadesporembalagem = unidEmb
      payload.qtdcomprimidos = unidEmb
    }
    const registroMs = str(row.registroms)
    if (registroMs) {
      payload.registroMS = registroMs
      payload.registrosMS = [
        {
          '@xdata.type': 'XData.Default.RegistroMS',
          registroMS: registroMs,
        },
      ]
    }
  }

  if (subgrupo.id !== undefined) {
    payload['subgrupo@xdata.ref'] = xdataRef('SubGrupoProdutoDrogaria', subgrupo.id)
  }
  if (categoria.id !== undefined) {
    payload['categoria@xdata.ref'] = xdataRef('Categoria', categoria.id)
  }
  if (laboratorio.id !== undefined) {
    payload['laboratorio@xdata.ref'] = xdataRef('Laboratorio', laboratorio.id)
  }
  if (grupodepreco.id !== undefined) {
    payload['grupodeprecos@xdata.ref'] = xdataRef('GrupoPreco', grupodepreco.id)
  }
  if (similar.id !== undefined) {
    payload['similar@xdata.ref'] = xdataRef('Similar', similar.id)
  }
  if (dcb.id !== undefined) {
    payload['dcb@xdata.ref'] = xdataRef('DCB', dcb.id)
  }
  if (cfopId !== undefined) {
    payload['cfopvenda@xdata.ref'] = xdataRef('CFOP', cfopId)
  }

  return warnings.length > 0 ? { ok: true, payload, warnings } : { ok: true, payload }
}
