import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

interface DcbIndexFile {
  source: string
  count: number
  byCode: Record<string, string>
}

type AnvisaDcbHit = { dcb: string; descricao: string }

let cached: DcbIndexFile | null | undefined
/** Nome uppercased → código Anvisa (montado uma vez). */
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
    const key = name.toLocaleUpperCase('pt-BR')
    if (!map.has(key)) {
      map.set(key, { dcb: code, descricao: name })
    }
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

/** Busca código Anvisa pelo nome da substância (match exato, case-insensitive). */
export function lookupAnvisaDcbByDescricao(descricao: string): AnvisaDcbHit | null {
  const key = String(descricao ?? '')
    .trim()
    .toLocaleUpperCase('pt-BR')
  if (!key) return null
  const map = getAnvisaDcbByNameMap()
  if (!map) return null
  return map.get(key) ?? null
}
