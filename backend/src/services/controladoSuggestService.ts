import type { AuxiliaryCatalog } from './auxiliaryService.js'
import { lookupCmedByEan, getCmedIndex } from './cmedIndexService.js'
import {
  lookupControladoByEan,
  getControladosEanIndex,
} from './controladosEanIndexService.js'
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
 * Gera sugestões de listacontrole/DCB/registroms.
 * Ordem: EAN na base validada (controlados.txt) → senão CMED + Portaria/antimicrobianos.
 * Nunca altera linhas; apenas sugere.
 */
export function suggestControlados(
  rows: Record<string, string>[],
  dcbCatalog?: AuxiliaryCatalog
): ControladoSuggestResult {
  const cmedIndex = getCmedIndex()
  const validatedIndex = getControladosEanIndex()
  if (!cmedIndex && !validatedIndex) {
    return {
      available: false,
      message:
        'Nenhum índice de controlados encontrado (CMED ou controlados-ean-index.json).',
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
    if (cmed) foundInCmed++

    const validated = lookupControladoByEan(ean)

    let suggestedLista = ''
    let matchedName = ''
    let substance = cmed?.s ?? ''
    let registro = ''
    let reasonParts: string[] = []

    if (validated) {
      // Base validada por EAN tem prioridade (não depende de tarja CMED).
      suggestedLista = validated.lista
      matchedName = validated.tipo === 'ANTIMICROBIANO' ? 'ANTIMICROBIANO' : validated.lista
      registro = (validated.registro || cmed?.r || '').trim()
      reasonParts = [
        `Base validada (EAN): ${validated.tipo} → ${validated.lista}`,
      ]
      if (cmed?.s) reasonParts.push(`CMED: ${cmed.s}`)
    } else {
      if (!cmed) return
      // OTC na CMED: não marcar via Portaria/substância.
      if (isTarjaSemControle(cmed.t)) return

      const listaMatch = matchSubstanceToLista(cmed.s)
      if (!listaMatch) return

      suggestedLista = listaMatch.listacontrole
      matchedName = listaMatch.matchedName
      substance = cmed.s
      registro = (cmed.r ?? '').trim()
      reasonParts = [
        `CMED: ${cmed.s}`,
        suggestedLista === 'T'
          ? `Antimicrobiano (RDC 471): ${matchedName} → T`
          : `Portaria 344: ${matchedName} → ${suggestedLista}`,
      ]
    }

    const dcbFromName = findDcbId(substance || matchedName, matchedName, dcbIndex)
    const suggestedDcb = (validated?.dcb || dcbFromName.id || '').trim()
    const suggestedDcbNome =
      validated?.dcb && dcbCatalog?.get(validated.dcb)
        ? dcbCatalog.get(validated.dcb)!
        : dcbFromName.nome
    const currentLista = (row.listacontrole ?? '').trim()
    const currentDcb = (row.dcb ?? '').trim()
    const currentRegistro = (row.registroms ?? '').trim()
    const kind = classifyKind(
      currentLista,
      currentDcb,
      currentRegistro,
      suggestedLista,
      suggestedDcb,
      registro
    )

    if (kind === 'confirm') return

    if (registro) reasonParts.push(`Registro MS: ${registro}`)
    if (validated?.dcb) reasonParts.push(`DCB Anvisa (base): ${validated.dcb}`)
    if (dcbFromName.id && dcbFromName.id !== validated?.dcb) {
      reasonParts.push(`DCB auxiliar: ${dcbFromName.id} (${dcbFromName.nome})`)
    } else if (!suggestedDcb && dcbCatalog) {
      reasonParts.push('DCB não encontrado no auxiliar')
    } else if (!suggestedDcb) {
      reasonParts.push('Envie dcb.csv para sugerir o id DCB')
    }

    suggestions.push({
      rowIndex,
      row: rowIndex + 2,
      ean,
      codigo: (row.codigo ?? '').trim(),
      nome: (row.nome ?? cmed?.p ?? '').trim(),
      substance,
      matchedName,
      suggestedLista,
      suggestedDcb,
      suggestedDcbNome,
      registro,
      currentLista,
      currentDcb,
      currentRegistro,
      kind,
      tarja: cmed?.t ?? '',
      produtoCmed: cmed?.p ?? '',
      reason: reasonParts.join(' · '),
    })
  })

  return {
    available: true,
    cmedSource: [
      cmedIndex?.source,
      validatedIndex ? `controlados.txt (${validatedIndex.eanCount} EANs)` : null,
    ]
      .filter(Boolean)
      .join(' + '),
    totalRows: rows.length,
    withEan,
    foundInCmed,
    controlledCandidates: suggestions.length,
    suggestions,
  }
}
