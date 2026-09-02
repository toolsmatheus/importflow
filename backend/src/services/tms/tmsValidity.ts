import { DEFAULT_TMS_BASE } from './tmsConfig.js'
import { tmsJsonRequest } from './tmsClient.js'
import type { BatchInsertResult } from './tmsTypes.js'

/**
 * Insere validade de produto não controlado (sistema antigo).
 * Rota: POST /tms/xdata/ValidadeSistemaAntigo
 * validade no formato ISO YYYY-MM-DD.
 */
export async function insertValidadeSistemaAntigo(
  data: { idproduto: number; validade: string; quantidade: number },
  baseUrl = DEFAULT_TMS_BASE
): Promise<BatchInsertResult> {
  const root = baseUrl.replace(/\/$/, '')
  const body = JSON.stringify({
    '@xdata.type': 'XData.Default.ValidadeSistemaAntigo',
    idproduto: data.idproduto,
    validade: data.validade,
    quantidade: data.quantidade,
  })
  return tmsJsonRequest(`${root}/tms/xdata/ValidadeSistemaAntigo`, { method: 'POST', body }, baseUrl)
}
