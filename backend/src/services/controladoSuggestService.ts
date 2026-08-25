import type { AuxiliaryCatalog } from './auxiliaryService.js'
import { lookupCmedByEan, getCmedIndex } from './cmedIndexService.js'
import { matchSubstanceToLista, normalizeSubstanceName } from './portaria344Service.js'

export type ControladoSuggestKind = 'empty' | 'conflict' | 'confirm'

export interface ControladoSuggestion {
  /** Índice 0-based na lista de rows enviada */
  rowIndex: number
  /** Número de linha CSV (header = 1) */
  row: number
  ean: string
  codigo: string
  nome: string
  substance: string
  matchedName: string
  suggestedLista: string
  suggestedDcb: string
  suggestedDcbNome: string
  /** Registro MS (CMED) — gravar em registroms ao aplicar */
  registro: string
  currentLista: string
  currentDcb: string
  currentRegistro: string
  kind: ControladoSuggestKind
  tarja: string
  produtoCmed: string
  reason: string
}

export interface ControladoSuggestResult {
  available: boolean
  message?: string
  cmedSource?: string
  totalRows: number
  withEan: number
  foundInCmed: number
  controlledCandidates: number
  suggestions: ControladoSuggestion[]
}

type DcbNameIndex = {
  exact: Map<string, { id: string; nome: string }>
  entries: Array<{ id: string; nome: string; norm: string }>
}

/** Normaliza nomes do catálogo DCB uma vez por chamada de sugestão. */
function buildDcbNameIndex(dcbCatalog: AuxiliaryCatalog): DcbNameIndex {
  const exact = new Map<string, { id: string; nome: string }>()
  const entries: Array<{ id: string; nome: string; norm: string }> = []
  for (const [id, nome] of dcbCatalog.entries()) {
    const norm = normalizeSubstanceName(nome)
    if (!norm) continue
    if (!exact.has(norm)) exact.set(norm, { id, nome })
    entries.push({ id, nome, norm })
  }
  return { exact, entries }
}

function findDcbId(
  substanceName: string,
  matchedName: string,
  dcbIndex?: DcbNameIndex
): { id: string; nome: string } {
  if (!dcbIndex || dcbIndex.entries.length === 0) return { id: '', nome: '' }

  const targets = [matchedName, ...substanceName.split(';').map((s) => s.trim())]
    .map(normalizeSubstanceName)
    .filter(Boolean)

  for (const t of targets) {
    const hit = dcbIndex.exact.get(t)
    if (hit) return hit
  }

  let best: { id: string; nome: string; score: number } | null = null
  for (const entry of dcbIndex.entries) {
    for (const t of targets) {
      let score = 0
      if (entry.norm === t) score = 100
      else if (entry.norm.includes(t) || t.includes(entry.norm)) {
        score = Math.min(entry.norm.length, t.length)
      }
      if (score > 0 && (!best || score > best.score)) {
        best = { id: entry.id, nome: entry.nome, score }
        if (score === 100) return { id: entry.id, nome: entry.nome }
      }
    }
  }

  return best ? { id: best.id, nome: best.nome } : { id: '', nome: '' }
}

function classifyKind(
  currentLista: string,
  currentDcb: string,
  currentRegistro: string,
  suggestedLista: string,
  suggestedDcb: string,
  suggestedRegistro: string
): ControladoSuggestKind {
  const listaDiff = currentLista && currentLista !== suggestedLista
  const dcbDiff = suggestedDcb && currentDcb && currentDcb !== suggestedDcb
  const registroDiff =
    suggestedRegistro && currentRegistro && currentRegistro !== suggestedRegistro
  if (listaDiff || dcbDiff || registroDiff) return 'conflict'

  const needsLista = !currentLista
  const needsDcb = Boolean(suggestedDcb) && !currentDcb
  const needsRegistro = Boolean(suggestedRegistro) && !currentRegistro
  if (needsLista || needsDcb || needsRegistro) return 'empty'

  return 'confirm'
}

/** CMED "Tarja Sem Tarja" = OTC; não sugerir Portaria 344 (ex.: Doricin / orfenadrina). */
function isTarjaSemControle(tarja: string): boolean {
  const t = tarja.trim().toLocaleLowerCase('pt-BR')
  if (!t) return false
  return t.includes('sem tarja') || t === 'isento' || t.includes('sem restri')
}

/**
 * Gera sugestões de listacontrole/DCB/registroms a partir de EAN → CMED → Portaria 344.
 * Nunca altera linhas; apenas sugere.
 */
export function suggestControlados(
  rows: Record<string, string>[],
  dcbCatalog?: AuxiliaryCatalog
): ControladoSuggestResult {
  const index = getCmedIndex()
  if (!index) {
    return {
      available: false,
      message:
        'Índice CMED não encontrado. Gere data/reference/cmed-ean-index.json a partir de cmed.xlsx.',
      totalRows: rows.length,
      withEan: 0,
      foundInCmed: 0,
      controlledCandidates: 0,
      suggestions: [],
    }
  }

  let withEan = 0
  let foundInCmed = 0
  const suggestions: ControladoSuggestion[] = []
  const dcbIndex = dcbCatalog && dcbCatalog.size > 0 ? buildDcbNameIndex(dcbCatalog) : undefined

  rows.forEach((row, rowIndex) => {
    const ean = (row.codigobarras ?? '').replace(/\D/g, '')
    if (!ean) return
    withEan++

    const cmed = lookupCmedByEan(ean)
    if (!cmed) return
    foundInCmed++

    // OTC na CMED: não marcar como controlado mesmo se a substância aparece na Portaria.
    if (isTarjaSemControle(cmed.t)) return

    const listaMatch = matchSubstanceToLista(cmed.s)
    if (!listaMatch) return

    const dcb = findDcbId(cmed.s, listaMatch.matchedName, dcbIndex)
    const currentLista = (row.listacontrole ?? '').trim()
    const currentDcb = (row.dcb ?? '').trim()
    const currentRegistro = (row.registroms ?? '').trim()
    const registro = (cmed.r ?? '').trim()
    const kind = classifyKind(
      currentLista,
      currentDcb,
      currentRegistro,
      listaMatch.listacontrole,
      dcb.id,
      registro
    )

    // Já igual ao sugerido (lista/DCB/registro MS): não listar
    if (kind === 'confirm') {
      return
    }

    const reasonParts = [
      `CMED: ${cmed.s}`,
      `Portaria 344: ${listaMatch.matchedName} → ${listaMatch.listacontrole}`,
    ]
    if (registro) reasonParts.push(`Registro MS: ${registro}`)
    if (dcb.id) reasonParts.push(`DCB auxiliar: ${dcb.id} (${dcb.nome})`)
    else if (dcbCatalog) reasonParts.push('DCB não encontrado no auxiliar')
    else reasonParts.push('Envie dcb.csv para sugerir o id DCB')

    suggestions.push({
      rowIndex,
      row: rowIndex + 2,
      ean,
      codigo: (row.codigo ?? '').trim(),
      nome: (row.nome ?? cmed.p ?? '').trim(),
      substance: cmed.s,
      matchedName: listaMatch.matchedName,
      suggestedLista: listaMatch.listacontrole,
      suggestedDcb: dcb.id,
      suggestedDcbNome: dcb.nome,
      registro,
      currentLista,
      currentDcb,
      currentRegistro,
      kind,
      tarja: cmed.t,
      produtoCmed: cmed.p,
      reason: reasonParts.join(' · '),
    })
  })

  return {
    available: true,
    cmedSource: index.source,
    totalRows: rows.length,
    withEan,
    foundInCmed,
    controlledCandidates: suggestions.length,
    suggestions,
  }
}
