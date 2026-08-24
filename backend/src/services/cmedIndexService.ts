import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

export interface CmedEanEntry {
  /** Princípio ativo (SUBSTÂNCIA CMED) */
  s: string
  /** Registro MS */
  r: string
  /** Nome comercial */
  p: string
  /** Tarja */
  t: string
}

interface CmedIndexFile {
  source: string
  eanCount: number
  substanceCount: number
  byEan: Record<string, CmedEanEntry>
}

let cached: CmedIndexFile | null = null

function resolveIndexPath(): string | null {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const candidates = [
    path.resolve(process.cwd(), 'data/reference/cmed-ean-index.json'),
    path.resolve(process.cwd(), '../data/reference/cmed-ean-index.json'),
    path.resolve(__dirname, '../../../data/reference/cmed-ean-index.json'),
  ]
  return candidates.find((p) => existsSync(p)) ?? null
}

export function getCmedIndex(): CmedIndexFile | null {
  if (cached) return cached
  const filePath = resolveIndexPath()
  if (!filePath) return null
  cached = JSON.parse(readFileSync(filePath, 'utf-8')) as CmedIndexFile
  return cached
}

export function lookupCmedByEan(ean: string): CmedEanEntry | null {
  const digits = ean.replace(/\D/g, '')
  if (!digits) return null
  const index = getCmedIndex()
  if (!index) return null
  return index.byEan[digits] ?? null
}
