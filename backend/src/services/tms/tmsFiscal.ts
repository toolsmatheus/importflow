import type { CatalogosBuscaProduto } from '../../models/produto-tms.model.js'
import { DEFAULT_TMS_BASE } from './tmsConfig.js'
import {
  extractCreatedEntityId,
  extractODataRows,
  tmsJsonRequest,
} from './tmsClient.js'

function formatAliquotaDescricao(aliquota: number): string {
  const label = Number.isInteger(aliquota)
    ? String(aliquota)
    : String(aliquota).replace('.', ',')
  return `ALIQUOTA ${label}%`
}

type ZeroRateKind = 'st' | 'isento' | 'semincidencia'

const ZERO_RATE_SPECS: Record<
  ZeroRateKind,
  { descricao: string; aliquotaisento: number; catalogKey: keyof CatalogosBuscaProduto }
> = {
  st: {
    descricao: 'SUBSTITUIÇÃO TRIBUTARIA',
    aliquotaisento: 0,
    catalogKey: 'aliquotaStId',
  },
  isento: {
    descricao: 'ISENTO',
    aliquotaisento: 1,
    catalogKey: 'aliquotaIsentoId',
  },
  semincidencia: {
    descricao: 'SEM INCIDENCIA',
    aliquotaisento: 2,
    catalogKey: 'aliquotaSemIncidenciaId',
  },
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

async function insertZeroRateAliquotaIcms(
  kind: ZeroRateKind,
  baseUrl = DEFAULT_TMS_BASE
): Promise<{ ok: boolean; id?: number; message?: string }> {
  const spec = ZERO_RATE_SPECS[kind]
  const root = baseUrl.replace(/\/$/, '')
  const body = JSON.stringify({
    ativo: true,
    descricao: spec.descricao,
    tipoaliquota: 'alSAIDA',
    tipoImposto: 'tipICMS',
    aliquota: 0,
    aliquotaisento: spec.aliquotaisento,
    aliquotaNaoConsumidorFinal: 0,
  })

  const result = await tmsJsonRequest(
    `${root}/tms/xdata/AliquotaICMS`,
    { method: 'POST', body },
    baseUrl
  )
  if (!result.ok) {
    return {
      ok: false,
      message: result.message || `Falha ao inserir AliquotaICMS ${spec.descricao}`,
    }
  }

  let id = extractCreatedEntityId(result.message)
  if (id === null) {
    const filterUrl =
      `${root}/tms/xdata/AliquotaICMS` +
      `?$filter=aliquota eq 0 and tipoImposto eq 'tipICMS'&$top=20`
    const lookup = await tmsJsonRequest(filterUrl, { method: 'GET' }, baseUrl)
    if (lookup.ok && lookup.message) {
      try {
        const parsed = JSON.parse(lookup.message) as unknown
        for (const row of extractODataRows(parsed)) {
          if (Number(row.aliquota) !== 0) continue
          if (String(row.tipoImposto ?? '') !== 'tipICMS') continue
          if (Number(row.aliquotaisento) !== spec.aliquotaisento) continue
          const found = Number(row.id)
          if (Number.isFinite(found) && found > 0) {
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
      message: `AliquotaICMS ${spec.descricao} inserida, mas o id não foi retornado`,
    }
  }

  return { ok: true, id }
}

/**
 * Garante que o percentual existe no catálogo (insere no TMS se faltar).
 */
export async function garantirAliquotaPercentual(
  catalogs: CatalogosBuscaProduto,
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
 * Garante AliquotaICMS de alíquota 0 (ST / Isento / Sem incidência).
 * Sem isso o mapper usava ids fixos (ex.: 500) que podem não existir no banco.
 */
export async function garantirAliquotasTaxaZero(
  catalogs: CatalogosBuscaProduto,
  baseUrl = DEFAULT_TMS_BASE
): Promise<{ ok: boolean; message?: string; inserted: ZeroRateKind[] }> {
  const inserted: ZeroRateKind[] = []
  const kinds: ZeroRateKind[] = ['st', 'isento', 'semincidencia']

  for (const kind of kinds) {
    const key = ZERO_RATE_SPECS[kind].catalogKey
    const current = Number(catalogs[key])
    if (Number.isFinite(current) && current > 0) continue

    const created = await insertZeroRateAliquotaIcms(kind, baseUrl)
    if (!created.ok || created.id === undefined) {
      return {
        ok: false,
        message:
          created.message ||
          `Falha ao garantir AliquotaICMS ${ZERO_RATE_SPECS[kind].descricao}`,
        inserted,
      }
    }

    ;(catalogs[key] as number) = created.id
    inserted.push(kind)
  }

  return { ok: true, inserted }
}
