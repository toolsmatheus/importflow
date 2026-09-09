import { describe, expect, it, vi } from 'vitest'

vi.mock('./cmedIndexService.js', () => ({
  getCmedIndex: () => ({ source: 'test', eanCount: 1, substanceCount: 1, byEan: {} }),
  lookupCmedByEan: (ean: string) => {
    if (ean === '7891111111111') {
      return {
        s: 'CLORIDRATO DE LOPERAMIDA',
        r: '1053501590011',
        p: 'LOPERAMIDA TESTE',
        t: 'Vermelha sob restrição',
      }
    }
    if (ean === '7892222222222') {
      return {
        s: 'SUBSTANCIA SEM DCB XYZ123',
        r: '9999999999999',
        p: 'PRODUTO SEM DCB',
        t: 'Vermelha sob restrição',
      }
    }
    return null
  },
}))

vi.mock('./controladosEanIndexService.js', () => ({
  getControladosEanIndex: () => null,
  lookupControladoByEan: () => null,
}))

vi.mock('./portaria344Service.js', async () => {
  const actual = await vi.importActual<typeof import('./portaria344Service.js')>(
    './portaria344Service.js'
  )
  return {
    ...actual,
    matchSubstanceToLista: (substance: string) => {
      if (substance.includes('LOPERAMIDA')) {
        return { matchedName: 'LOPERAMIDA', listacontrole: 'C1' }
      }
      if (substance.includes('SUBSTANCIA SEM DCB')) {
        return { matchedName: 'SUBSTANCIA SEM DCB XYZ123', listacontrole: 'C1' }
      }
      return null
    },
  }
})

import { suggestControlados } from './controladoSuggestService.js'

describe('suggestControlados — DCB via princípio ativo CMED', () => {
  it('preenche DCB Anvisa a partir da substância CMED sem dcb.csv', () => {
    const result = suggestControlados([
      {
        codigo: '4307',
        nome: 'LOPERAMIDA TESTE',
        codigobarras: '7891111111111',
        listacontrole: '',
        dcb: '',
        registroms: '',
      },
    ])

    expect(result.available).toBe(true)
    expect(result.suggestions).toHaveLength(1)
    const s = result.suggestions[0]
    expect(s.suggestedLista).toBe('C1')
    expect(s.suggestedDcb).toBe('05405')
    expect(s.suggestedDcbNome.toLocaleUpperCase('pt-BR')).toContain('LOPERAMIDA')
    expect(s.reason).toContain('DCB Anvisa (princípio ativo)')
  })

  it('não sugere controlado quando DCB não é encontrado', () => {
    const result = suggestControlados([
      {
        codigo: '9999',
        nome: 'PRODUTO SEM DCB',
        codigobarras: '7892222222222',
        listacontrole: '',
        dcb: '',
        registroms: '',
      },
    ])

    expect(result.available).toBe(true)
    expect(result.suggestions).toHaveLength(0)
  })
})
