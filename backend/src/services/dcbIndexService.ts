import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

interface DcbIndexFile {
  source: string
  count: number
  byCode: Record<string, string>
}

let cached: DcbIndexFile | null | undefined

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
    return null
  }
  cached = JSON.parse(readFileSync(filePath, 'utf-8')) as DcbIndexFile
  return cached
}

export function lookupAnvisaDcb(code: string): { dcb: string; descricao: string } | null {
  const padded = padDcbCode(code)
  const index = getAnvisaDcbIndex()
  if (!index || !padded) return null
  const descricao = index.byCode[padded]
  if (!descricao) return null
  return { dcb: padded, descricao }
}
