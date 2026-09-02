import { padDcbCode } from '../dcbIndexService.js'
import type { ProductLookupCatalogs } from '../productTmsMapper.js'
import { DEFAULT_TMS_BASE } from './tmsConfig.js'
import { buildMigracaoMap, fetchTmsEntityRows } from './tmsClient.js'
import type { ProductExistenceCatalogs, TmsDcbRecord } from './tmsTypes.js'

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

/**
 * CSV often sends codigo=0 when only the barcode is known.
 * Migracao "0" exists in TMS for unrelated products — never use 0 as a lookup key.
 */
export function usableMigracaoCodigo(codigo: string): string {
  const t = codigo.trim()
  if (!t) return ''
  const n = Number(t)
  if (Number.isFinite(n) && n === 0) return ''
  return t
}

/** Resolve produto by migracao (if usable) then barcode. */
export function resolveProdutoIdFromCsv(
  existence: ProductExistenceCatalogs,
  codigo: string,
  codigobarras: string
): number | undefined {
  const migracao = usableMigracaoCodigo(codigo)
  let produtoId: number | undefined
  if (migracao) {
    produtoId =
      existence.byMigracao.get(migracao) ??
      existence.byMigracao.get(String(Number(migracao)))
  }
  if (produtoId === undefined && codigobarras) {
    produtoId =
      existence.byBarcode.get(codigobarras) ??
      existence.byBarcode.get(codigobarras.replace(/\D/g, ''))
  }
  return produtoId
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
  const tipoclassesngpcById = new Map<number, string>()
  const migracaoById = new Map<number, string>()
  const rows = await fetchTmsEntityRows('Produto', baseUrl)

  for (const row of rows) {
    const id = Number(row.id)
    if (!Number.isFinite(id)) continue
    addExistenceKey(byBarcode, row.codigoBarras ?? row.CodigoBarras, id)
    const migracao = row.codigo_migracao
    addExistenceKey(byMigracao, migracao, id)
    if (migracao !== undefined && migracao !== null && String(migracao).trim()) {
      if (!migracaoById.has(id)) migracaoById.set(id, String(migracao).trim())
    }
    tipoclassesngpcById.set(id, String(row.tipoclassesngpc ?? 'tcNenhuma'))
  }

  return { byBarcode, byMigracao, tipoclassesngpcById, migracaoById }
}
