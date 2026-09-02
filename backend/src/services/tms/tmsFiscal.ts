import type { ProductLookupCatalogs } from '../productTmsMapper.js'
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
