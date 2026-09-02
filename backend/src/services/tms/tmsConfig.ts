export const DEFAULT_TMS_BASE = process.env.TMS_BASE_URL ?? 'http://localhost:2001'
/** Sufixo combinado com a versão para gerar a senha Basic Auth do TMS. */
export const TMS_AUTH_SUFFIX = process.env.TMS_AUTH_SUFFIX ?? 'k3g88Ii5nQr7Z2D6sPTP'

export function getDefaultTmsBaseUrl() {
  return DEFAULT_TMS_BASE
}
