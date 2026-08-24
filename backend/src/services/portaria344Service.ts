import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

interface Portaria344File {
  source: string
  note?: string
  lists: Record<string, string>
}

let cached: Portaria344File | null = null

const SALT_PREFIXES = [
  'CLORIDRATO DE',
  'OXALATO DE',
  'SULFATO DE',
  'MALEATO DE',
  'HEMIFUMARATO DE',
  'HEMITARTARATO DE',
  'BROMIDRATO DE',
  'HIDROBROMETO DE',
  'CITRATO DE',
  'SUCCINATO DE',
  'CARBONATO DE',
  'DECANOATO DE',
  'CIPIONATO DE',
  'PROPIONATO DE',
  'UNDECILATO DE',
  'DIMESILATO DE',
  'MESILATO DE',
  'FOSFATO DE',
  'ACETATO DE',
  'BENZOATO DE',
  'VALERATO DE',
  'FEMPROPIONATO DE',
  'ISOCAPROATO DE',
]

const SALT_FIRST = new Set([
  'CLORIDRATO',
  'OXALATO',
  'SULFATO',
  'MALEATO',
  'CITRATO',
  'SUCCINATO',
  'CARBONATO',
  'DECANOATO',
  'CIPIONATO',
  'DIMESILATO',
  'MESILATO',
  'BROMIDRATO',
  'HIDROBROMETO',
  'HEMIFUMARATO',
  'HEMITARTARATO',
  'FOSFATO',
  'ACETATO',
  'PROPIONATO',
  'UNDECILATO',
])

const HYDRATION_RE =
  /\b(MONOIDRATAD[OA]|DI-?HIDRATAD[OA]|PENTAIDRATAD[OA]|HEMI-?HIDRATAD[OA]|ANIDRO)\b/g

/** Prioridade: lista mais restritiva quando há associação. */
const LIST_PRIORITY: Record<string, number> = {
  A1: 100,
  A2: 95,
  A3: 90,
  B1: 80,
  B2: 75,
  C1: 60,
  C2: 55,
  C3: 50,
  C4: 45,
  C5: 40,
  D1: 30,
  D2: 25,
  F1: 20,
  F2: 15,
  F3: 10,
  F4: 5,
}

function resolvePortariaPath(): string | null {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const candidates = [
    path.resolve(process.cwd(), 'data/reference/portaria344.json'),
    path.resolve(process.cwd(), '../data/reference/portaria344.json'),
    path.resolve(__dirname, '../../../data/reference/portaria344.json'),
  ]
  return candidates.find((p) => existsSync(p)) ?? null
}

export function getPortaria344(): Portaria344File | null {
  if (cached) return cached
  const filePath = resolvePortariaPath()
  if (!filePath) return null
  cached = JSON.parse(readFileSync(filePath, 'utf-8')) as Portaria344File
  return cached
}

export function normalizeSubstanceName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9; ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripHydrationAndNotes(name: string): string {
  return name
    .replace(/\([^)]*\)/g, ' ')
    .replace(HYDRATION_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Extrai nomes-base de um campo SUBSTÂNCIA da CMED (pode ter associações). */
export function extractBaseNames(substance: string): string[] {
  const parts = substance
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
  const out = new Set<string>()

  for (const part of parts) {
    let n = stripHydrationAndNotes(normalizeSubstanceName(part))
    if (!n) continue
    out.add(n)

    for (const pref of SALT_PREFIXES) {
      const pn = normalizeSubstanceName(pref)
      if (n.startsWith(`${pn} `)) {
        out.add(n.slice(pn.length + 1).trim())
      }
    }

    const tokens = n.split(' ')
    if (tokens.length >= 3 && SALT_FIRST.has(tokens[0]) && tokens[1] === 'DE') {
      out.add(tokens.slice(2).join(' '))
    }
  }

  return [...out].filter(Boolean)
}

export interface SubstanceListMatch {
  matchedName: string
  listacontrole: string
}

export function matchSubstanceToLista(substance: string): SubstanceListMatch | null {
  const portaria = getPortaria344()
  if (!portaria) return null

  const lists = portaria.lists
  let best: SubstanceListMatch | null = null

  for (const base of extractBaseNames(substance)) {
    let hit: SubstanceListMatch | null = null

    if (lists[base]) {
      hit = { matchedName: base, listacontrole: lists[base] }
    } else {
      for (const [key, lista] of Object.entries(lists)) {
        if (key.length < 5) continue
        if (
          base === key ||
          base.endsWith(` ${key}`) ||
          base.startsWith(`${key} `) ||
          ` ${base} `.includes(` ${key} `)
        ) {
          hit = { matchedName: key, listacontrole: lista }
          break
        }
      }
    }

    if (!hit) continue
    if (
      !best ||
      (LIST_PRIORITY[hit.listacontrole] ?? 0) > (LIST_PRIORITY[best.listacontrole] ?? 0)
    ) {
      best = hit
    }
  }

  return best
}
