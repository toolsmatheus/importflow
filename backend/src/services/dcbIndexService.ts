import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { extractBaseNames, normalizeSubstanceName } from './portaria344Service.js'

interface DcbIndexFile {
  source: string
  count: number
  byCode: Record<string, string>
}

type AnvisaDcbHit = { dcb: string; descricao: string }

let cached: DcbIndexFile | null | undefined
/** Nome uppercased / normalizado → código Anvisa (montado uma vez). */
let byNameCache: Map<string, AnvisaDcbHit> | null | undefined

export function padDcbCode(value: string): string {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return String(value ?? '').trim()
  return digits.padStart(5, '0')
}

function resolveIndexPath(): string | null {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const candidates = [
    path.resolve(process.cwd(), 'data/reference/dcb-index.json'),
    path.resolve(process.cwd(), '../data/reference/dcb-index.json'),
    path.resolve(__dirname, '../../../data/reference/dcb-index.json'),
  ]
  return candidates.find((p) => existsSync(p)) ?? null
}

export function getAnvisaDcbIndex(): DcbIndexFile | null {
  if (cached !== undefined) return cached
  const filePath = resolveIndexPath()
  if (!filePath) {
    cached = null
    byNameCache = null
    return null
  }
  cached = JSON.parse(readFileSync(filePath, 'utf-8')) as DcbIndexFile
  byNameCache = undefined
  return cached
}

function getAnvisaDcbByNameMap(): Map<string, AnvisaDcbHit> | null {
  if (byNameCache !== undefined) return byNameCache
  const index = getAnvisaDcbIndex()
  if (!index) {
    byNameCache = null
    return null
  }
  const map = new Map<string, AnvisaDcbHit>()
  for (const [code, name] of Object.entries(index.byCode)) {
    const hit: AnvisaDcbHit = { dcb: code, descricao: name }
    const upper = name.toLocaleUpperCase('pt-BR')
    if (!map.has(upper)) map.set(upper, hit)
    const norm = normalizeSubstanceName(name)
    if (norm && !map.has(norm)) map.set(norm, hit)
  }
  byNameCache = map
  return map
}

export function lookupAnvisaDcb(code: string): AnvisaDcbHit | null {
  const padded = padDcbCode(code)
  const index = getAnvisaDcbIndex()
  if (!index || !padded) return null
  const descricao = index.byCode[padded]
  if (!descricao) return null
  return { dcb: padded, descricao }
}

/** Busca código Anvisa pelo nome da substância (exato e normalizado). */
export function lookupAnvisaDcbByDescricao(descricao: string): AnvisaDcbHit | null {
  const raw = String(descricao ?? '').trim()
  if (!raw) return null
  const map = getAnvisaDcbByNameMap()
  if (!map) return null

  const upper = raw.toLocaleUpperCase('pt-BR')
  const direct = map.get(upper)
  if (direct) return direct

  const norm = normalizeSubstanceName(raw)
  if (norm) {
    const byNorm = map.get(norm)
    if (byNorm) return byNorm
  }
  return null
}

/**
 * Resolve DCB Anvisa a partir do princípio ativo CMED (e variantes).
 * Tenta o nome completo, partes separadas por `;` e nomes-base (sem sal).
 */
export function lookupAnvisaDcbBySubstance(
  substance: string,
  matchedName = ''
): AnvisaDcbHit | null {
  const candidates = [
    substance,
    matchedName,
    ...String(substance ?? '')
      .split(';')
      .map((s) => s.trim()),
    ...extractBaseNames(substance || matchedName),
  ]
    .map((s) => String(s ?? '').trim())
    .filter(Boolean)

  // Preferir match do nome mais específico primeiro (ex.: CLORIDRATO DE X antes de X).
  const seen = new Set<string>()
  for (const candidate of candidates) {
    const key = candidate.toLocaleUpperCase('pt-BR')
    if (seen.has(key)) continue
    seen.add(key)
    const hit = lookupAnvisaDcbByDescricao(candidate)
    if (hit) return hit
  }
  return null
}
