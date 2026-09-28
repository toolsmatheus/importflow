import { describe, expect, it } from 'vitest'
import {
  cell,
  parseOptionalCsvText,
  parsePositiveEstoque,
  parseValidityDate,
} from './optionalJobRuntime.js'

describe('optionalJobRuntime helpers', () => {
  it('parseOptionalCsvText normaliza cabeçalhos sem acento', () => {
    const rows = parseOptionalCsvText('Código;Quantidade\n1;10\n')
    expect(rows).toEqual([{ codigo: '1', quantidade: '10' }])
  })

  it('cell encontra aliases ignorando acento/caixa', () => {
    const row = { CodigoBarras: '789', estoque: '5' }
    expect(cell(row, 'codigobarras', 'codigobarra')).toBe('789')
    expect(cell(row, 'estoque', 'quantidade')).toBe('5')
  })

  it('parseValidityDate aceita BR e ISO', () => {
    expect(parseValidityDate('31/12/2026')).toBe('2026-12-31')
    expect(parseValidityDate('2026-01-15')).toBe('2026-01-15')
    expect(parseValidityDate('32/01/2026')).toBeNull()
    expect(parseValidityDate('')).toBeNull()
  })

  it('parsePositiveEstoque ignora vazio/≤0 e rejeita decimal', () => {
    expect(parsePositiveEstoque('')).toBeNull()
    expect(parsePositiveEstoque('0')).toBeNull()
    expect(parsePositiveEstoque('-1')).toBeNull()
    expect(parsePositiveEstoque('10')).toBe(10)
    expect(parsePositiveEstoque('10,5')).toBe('invalid')
    expect(parsePositiveEstoque('abc')).toBe('invalid')
  })
})
