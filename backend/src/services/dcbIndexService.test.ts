import { describe, expect, it } from 'vitest'
import {
  lookupAnvisaDcbByDescricao,
  lookupAnvisaDcbBySubstance,
} from './dcbIndexService.js'

describe('lookupAnvisaDcbByDescricao', () => {
  it('finds CLORIDRATO DE LOPERAMIDA', () => {
    const hit = lookupAnvisaDcbByDescricao('CLORIDRATO DE LOPERAMIDA')
    expect(hit).not.toBeNull()
    expect(hit?.dcb).toBe('05405')
  })

  it('finds LOPERAMIDA base name', () => {
    const hit = lookupAnvisaDcbByDescricao('LOPERAMIDA')
    expect(hit?.dcb).toBe('05404')
  })
})

describe('lookupAnvisaDcbBySubstance', () => {
  it('resolves CMED substance to Anvisa DCB code', () => {
    const hit = lookupAnvisaDcbBySubstance('CLORIDRATO DE LOPERAMIDA', 'LOPERAMIDA')
    expect(hit).not.toBeNull()
    expect(hit?.dcb).toBe('05405')
    expect(hit?.descricao.toLocaleUpperCase('pt-BR')).toContain('LOPERAMIDA')
  })

  it('falls back to base name when salt form is unknown', () => {
    // Prefer exact salt when present; if only base name matches via extractBaseNames
    const hit = lookupAnvisaDcbBySubstance('CLORIDRATO DE LOPERAMIDA')
    expect(hit?.dcb).toBe('05405')
  })

  it('returns null for empty substance', () => {
    expect(lookupAnvisaDcbBySubstance('')).toBeNull()
  })
})
