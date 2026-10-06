import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

export interface ControladoEanEntry {
  /** Lista de controle: A1, B1, C1, T, ... */
  lista: string
  tipo: string
  registro: string
  /** Código DCB Anvisa (5 dígitos), quando houver */
  dcb: string
  unidade: string
  apresentacao: string
  unidemb: string
}

interface ControladosEanIndexFile {
  source: string
  note?: string
  eanCount: number
  byLista?: Record<string, number>
  byEan: Record<string, ControladoEanEntry>
}

let cached: ControladosEanIndexFile | null | undefined

function resolveIndexPath(): string | null {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const candidates = [
    path.resolve(process.cwd(), 'data/reference/controlados-ean-index.json'),
    path.resolve(process.cwd(), '../data/reference/controlados-ean-index.json'),
    path.resolve(__dirname, '../../../data/reference/controlados-ean-index.json'),
  ]
  return candidates.find((p) => existsSync(p)) ?? null
}

export function getControladosEanIndex(): ControladosEanIndexFile | null {
  if (cached !== undefined) return cached
  const filePath = resolveIndexPath()
  if (!filePath) {
    cached = null
    return null
  }
  cached = JSON.parse(readFileSync(filePath, 'utf-8')) as ControladosEanIndexFile
  return cached
}

export function lookupControladoByEan(ean: string): ControladoEanEntry | null {
  const digits = ean.replace(/\D/g, '')
  if (!digits) return null
  const index = getControladosEanIndex()
  if (!index) return null
  return index.byEan[digits] ?? null
}
