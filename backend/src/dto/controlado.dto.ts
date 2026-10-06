import type { ControladoSuggestion } from '../models/controlado.model.js'

export interface ControladoSuggestResultDto {
  available: boolean
  message?: string
  cmedSource?: string
  totalRows: number
  withEan: number
  foundInCmed: number
  controlledCandidates: number
  suggestions: ControladoSuggestion[]
}

/** @deprecated Use ControladoSuggestResultDto */
export type ControladoSuggestResult = ControladoSuggestResultDto
