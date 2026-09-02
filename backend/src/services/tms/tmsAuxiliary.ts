import {
  lookupAnvisaDcb,
  lookupAnvisaDcbByDescricao,
  padDcbCode,
} from '../dcbIndexService.js'
import { DEFAULT_TMS_BASE } from './tmsConfig.js'
import { fetchTmsEntityRows, tmsJsonRequest } from './tmsClient.js'
import type {
  AuxiliaryExistenceCatalogs,
  AuxiliaryMigracaoEntity,
  BatchInsertResult,
  TmsAuxiliaryEntity,
} from './tmsTypes.js'

export const AUXILIARY_TMS_PATH: Record<TmsAuxiliaryEntity, string> = {
  grupo: 'GrupoProdutoDrogaria',
  subgrupo: 'SubGrupoProdutoDrogaria',
  categoria: 'Categoria',
  laboratorio: 'Laboratorio',
  grupodepreco: 'GrupoPreco',
  similar: 'Similar',
  dcb: 'DCB',
}

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
