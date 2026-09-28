/**
 * Valores de `listacontrole` aceitos pelo enum XData `tlTipoListaControlado` no TMS ToolsPharma.
 * Confirmado via insert real: C3/D/E/F/T NÃO existem no enum (T = antimicrobiano → tlNenhuma + tcAntimicrobiano).
 */
export const TMS_LISTA_CONTROLADO_CODES = [
  'A1',
  'A2',
  'A3',
  'B1',
  'B2',
  'C1',
  'C2',
  'C4',
  'C5',
] as const

export type TmsListaControladoCode = (typeof TMS_LISTA_CONTROLADO_CODES)[number]

const TMS_LISTA_SET = new Set<string>(TMS_LISTA_CONTROLADO_CODES)

export const TMS_LISTA_CONTROLADO_HINT = TMS_LISTA_CONTROLADO_CODES.join(', ')

/** Normaliza texto do CSV (A1, tlA1, LISTA A1, etc.) → código curto ou null se vazio. */
export function normalizeListaControladoCode(raw: string | undefined | null): string | null {
  if (raw == null) return null
  let u = String(raw).trim().toUpperCase()
  if (!u) return null
  u = u.replace(/\s+/g, '')
  u = u.replace(/^LISTA/, '')
  if (u.startsWith('TL') && u !== 'TLT') {
    u = u.slice(2)
  }
  if (!u || u === 'NENHUMA' || u === 'NENHUM') return null
  return u
}

export function isAntimicrobianoLista(raw: string | undefined | null): boolean {
  const u = normalizeListaControladoCode(raw) ?? String(raw ?? '').trim().toUpperCase()
  if (!u) return false
  const compact = u.replace(/\s+/g, '')
  return (
    compact === 'T' ||
    compact === 'TLT' ||
    compact === 'ANTIMICROBIANO' ||
    compact === 'ANTIMICROBIANOS' ||
    compact === 'ANTIBIOTICO' ||
    compact === 'ANTIBIOTICOS' ||
    compact === 'ANTIBIÓTICO' ||
    compact === 'ANTIBIÓTICOS'
  )
}

export function isValidListaControladoCsv(raw: string | undefined | null): boolean {
  if (raw == null || !String(raw).trim()) return true
  if (isAntimicrobianoLista(raw)) return true
  const code = normalizeListaControladoCode(raw)
  if (code == null) return true
  return TMS_LISTA_SET.has(code)
}

/**
 * Converte CSV → valor do enum XData (`tlA1`, `tlNenhuma`, …).
 * Retorna error se o código não existir no TMS.
 */
export function mapListaControlado(raw: string | undefined | null): {
  value: string
  error?: string
} {
  if (raw == null || !String(raw).trim()) {
    return { value: 'tlNenhuma' }
  }
  if (isAntimicrobianoLista(raw)) {
    return { value: 'tlNenhuma' }
  }
  const code = normalizeListaControladoCode(raw)
  if (code == null) {
    return { value: 'tlNenhuma' }
  }
  if (!TMS_LISTA_SET.has(code)) {
    return {
      value: 'tlNenhuma',
      error: `listacontrole "${String(raw).trim()}" inválida no TMS (aceitos: ${TMS_LISTA_CONTROLADO_HINT} ou T/antimicrobiano).`,
    }
  }
  return { value: `tl${code}` }
}
