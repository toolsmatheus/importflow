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
  currentLista: string
  currentDcb: string
  kind: ControladoSuggestKind
  tarja: string
  registro: string
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

function findDcbId(
  substanceName: string,
  matchedName: string,
  dcbCatalog?: AuxiliaryCatalog
): { id: string; nome: string } {
  if (!dcbCatalog || dcbCatalog.size === 0) return { id: '', nome: '' }

  const targets = [matchedName, ...substanceName.split(';').map((s) => s.trim())]
    .map(normalizeSubstanceName)
    .filter(Boolean)

  let best: { id: string; nome: string; score: number } | null = null

  for (const [id, nome] of dcbCatalog.entries()) {
    const n = normalizeSubstanceName(nome)
    if (!n) continue
    for (const t of targets) {
      let score = 0
      if (n === t) score = 100
      else if (n.includes(t) || t.includes(n)) score = Math.min(n.length, t.length)
      if (score > 0 && (!best || score > best.score)) {
        best = { id, nome, score }
      }
    }
  }

  return best ? { id: best.id, nome: best.nome } : { id: '', nome: '' }
}

function classifyKind(
  currentLista: string,
  currentDcb: string,
  suggestedLista: string,
  suggestedDcb: string
): ControladoSuggestKind {
  const listaEmpty = !currentLista
  const dcbEmpty = !currentDcb
  if (listaEmpty && dcbEmpty) return 'empty'

  const listaDiff = currentLista && currentLista !== suggestedLista
  const dcbDiff = suggestedDcb && currentDcb && currentDcb !== suggestedDcb
  if (listaDiff || dcbDiff) return 'conflict'

  return 'confirm'
}

/**
 * Gera sugestões de listacontrole/DCB a partir de EAN → CMED → Portaria 344.
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

  rows.forEach((row, rowIndex) => {
    const ean = (row.codigobarras ?? '').replace(/\D/g, '')
    if (!ean) return
    withEan++

    const cmed = lookupCmedByEan(ean)
    if (!cmed) return
    foundInCmed++

    const listaMatch = matchSubstanceToLista(cmed.s)
    if (!listaMatch) return

    const dcb = findDcbId(cmed.s, listaMatch.matchedName, dcbCatalog)
    const currentLista = (row.listacontrole ?? '').trim()
    const currentDcb = (row.dcb ?? '').trim()
    const kind = classifyKind(currentLista, currentDcb, listaMatch.listacontrole, dcb.id)

    // Já igual ao sugerido: não listar
    if (
      kind === 'confirm' &&
      currentLista === listaMatch.listacontrole &&
      (!dcb.id || currentDcb === dcb.id)
    ) {
      return
    }

    const reasonParts = [
      `CMED: ${cmed.s}`,
      `Portaria 344: ${listaMatch.matchedName} → ${listaMatch.listacontrole}`,
    ]
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
      currentLista,
      currentDcb,
      kind,
      tarja: cmed.t,
      registro: cmed.r,
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
