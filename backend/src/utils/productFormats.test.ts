import { describe, expect, it } from 'vitest'
import {
  computeMarkupFromCustoVenda,
  formatBrazilianDecimal,
  isValidCfop,
  isValidEanCheckDigit,
  isValidNcm,
  markupMatchesSale,
  parseBrazilianNumber,
} from './productFormats.js'

describe('parseBrazilianNumber', () => {
  it('parses comma decimal', () => {
    expect(parseBrazilianNumber('8,90')).toBe(8.9)
  })

  it('parses thousands with dot and comma decimal', () => {
    expect(parseBrazilianNumber('1.234,56')).toBe(1234.56)
  })

  it('parses plain integer', () => {
    expect(parseBrazilianNumber('100')).toBe(100)
  })

  it('returns null for invalid text', () => {
    expect(parseBrazilianNumber('abc')).toBeNull()
  })
})

describe('computeMarkupFromCustoVenda', () => {
  it('computes 50% markup', () => {
    expect(computeMarkupFromCustoVenda(10, 15)).toBe(50)
  })

  it('returns null when custo is zero', () => {
    expect(computeMarkupFromCustoVenda(0, 15)).toBeNull()
  })
})

describe('markupMatchesSale', () => {
  it('accepts within 1 cent tolerance', () => {
    expect(markupMatchesSale(10, 50, 15)).toBe(true)
    expect(markupMatchesSale(10, 50, 15.01)).toBe(true)
  })

  it('rejects inconsistent markup', () => {
    expect(markupMatchesSale(10, 40, 15)).toBe(false)
  })
})

describe('formatBrazilianDecimal', () => {
  it('formats with comma separator', () => {
    expect(formatBrazilianDecimal(50)).toBe('50,00')
    expect(formatBrazilianDecimal(33.333, 2)).toBe('33,33')
  })
})

describe('isValidEanCheckDigit', () => {
  it('validates EAN-13', () => {
    expect(isValidEanCheckDigit('7894900011517')).toBe(true)
  })

  it('rejects wrong check digit', () => {
    expect(isValidEanCheckDigit('7894900011510')).toBe(false)
  })
})

describe('format validators', () => {
  it('validates CFOP and NCM', () => {
    expect(isValidCfop('5102')).toBe(true)
    expect(isValidCfop('510')).toBe(false)
    expect(isValidNcm('30049099')).toBe(true)
    expect(isValidNcm('3004909')).toBe(false)
  })
})
