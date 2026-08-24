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
