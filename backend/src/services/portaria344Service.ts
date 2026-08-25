import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

interface Portaria344File {
  source: string
  note?: string
  count?: number
  lists: Record<string, string>
}

interface AntimicrobianosFile {
  source: string
  note?: string
  substances: string[]
}

let cachedPortaria: Portaria344File | null = null
let cachedAm: Set<string> | null | undefined

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
  'TARTARATO DE',
  'DIPROPIONATO DE',
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
  'TARTARATO',
  'DIPROPIONATO',
])

const HYDRATION_RE =
  /\b(MONOIDRATAD[OA]|DI-?HIDRATAD[OA]|TRI-?HIDRATAD[OA]|PENTAIDRATAD[OA]|HEMI-?HIDRATAD[OA]|ANIDRO)\b/g

/** Prioridade: lista mais restritiva quando há associação. T = antimicrobiano. */
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
  T: 35,
  D1: 30,
  D2: 25,
  F1: 20,
  F2: 15,
  F3: 10,
  F4: 5,
}

function resolveDataPath(...relative: string[]): string | null {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const candidates = [
    path.resolve(process.cwd(), ...relative),
    path.resolve(process.cwd(), '..', ...relative),
    path.resolve(__dirname, '../../../', ...relative),
  ]
  return candidates.find((p) => existsSync(p)) ?? null
}

export function getPortaria344(): Portaria344File | null {
  if (cachedPortaria) return cachedPortaria
  const filePath = resolveDataPath('data', 'reference', 'portaria344.json')
  if (!filePath) return null
  cachedPortaria = JSON.parse(readFileSync(filePath, 'utf-8')) as Portaria344File
  return cachedPortaria
}

function getAntimicrobianosSet(): Set<string> | null {
  if (cachedAm !== undefined) return cachedAm
  const filePath = resolveDataPath('data', 'reference', 'antimicrobianos.json')
  if (!filePath) {
    cachedAm = null
    return null
  }
  const file = JSON.parse(readFileSync(filePath, 'utf-8')) as AntimicrobianosFile
  cachedAm = new Set((file.substances ?? []).map((s) => normalizeSubstanceName(s)))
  return cachedAm
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
    .replace(/\b(SODIC[OA]|POTASSIC[OA]|CALCIC[OA]|MAGNESIC[OA])\b/g, ' ')
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

function matchInMap(
  base: string,
  lists: Record<string, string>
): SubstanceListMatch | null {
  if (lists[base]) {
    return { matchedName: base, listacontrole: lists[base] }
  }
  for (const [key, lista] of Object.entries(lists)) {
    if (key.length < 4) continue
    if (
      base === key ||
      base.endsWith(` ${key}`) ||
      base.startsWith(`${key} `) ||
      ` ${base} `.includes(` ${key} `)
    ) {
      return { matchedName: key, listacontrole: lista }
    }
  }
  return null
}

function matchAntimicrobiano(base: string, am: Set<string>): SubstanceListMatch | null {
  if (am.has(base)) {
    return { matchedName: base, listacontrole: 'T' }
  }
  for (const key of am) {
    if (key.length < 4) continue
    if (
      base === key ||
      base.endsWith(` ${key}`) ||
      base.startsWith(`${key} `) ||
      ` ${base} `.includes(` ${key} `)
    ) {
      return { matchedName: key, listacontrole: 'T' }
    }
  }
  return null
}

/**
 * Resolve substância CMED → lista de controle.
 * Portaria 344 (A1–C5) tem prioridade sobre antimicrobianos (T / RDC 471).
 */
export function matchSubstanceToLista(substance: string): SubstanceListMatch | null {
  const portaria = getPortaria344()
  const am = getAntimicrobianosSet()
  if (!portaria && !am) return null

  const lists = portaria?.lists ?? {}
  let best: SubstanceListMatch | null = null

  for (const base of extractBaseNames(substance)) {
    const hit =
      matchInMap(base, lists) ?? (am ? matchAntimicrobiano(base, am) : null)
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
