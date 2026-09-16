import { describe, expect, it } from 'vitest'
import {
  computeMarkupFromCustoVenda,
  eanValidationFailureReason,
  formatBrazilianDecimal,
  isValidCfop,
  isValidEanCheckDigit,
  isValidNcm,
  markupMatchesSale,
  parseBrazilianNumber,
  parseCodigoAdicionalList,
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
  it('accepts EAN-8', () => {
    expect(isValidEanCheckDigit('96385074')).toBe(true)
  })

  it('accepts UPC-A (12)', () => {
    expect(isValidEanCheckDigit('042100005264')).toBe(true)
  })

  it('validates EAN-13', () => {
    expect(isValidEanCheckDigit('7894900011517')).toBe(true)
  })

  it('accepts GTIN-14', () => {
    // EAN-13 7894900011517 padded to GTIN-14
    expect(isValidEanCheckDigit('07894900011517')).toBe(true)
  })

  it('rejects wrong check digit', () => {
    expect(isValidEanCheckDigit('7894900011510')).toBe(false)
  })

  it('rejects unsupported lengths', () => {
    expect(isValidEanCheckDigit('123')).toBe(false)
    expect(isValidEanCheckDigit('12345678901')).toBe(false) // 11
  })
})

describe('eanValidationFailureReason', () => {
  it('reports invalid length', () => {
    expect(eanValidationFailureReason('123')).toContain('tamanho inválido')
  })

  it('reports bad check digit', () => {
    expect(eanValidationFailureReason('7894900011510')).toContain('dígito verificador')
  })

  it('returns null for valid EAN-13', () => {
    expect(eanValidationFailureReason('7894900011517')).toBeNull()
  })
})

describe('parseCodigoAdicionalList', () => {
  it('splits by comma and trims', () => {
    expect(parseCodigoAdicionalList(' 111 , 222 ; 333 ')).toEqual(['111', '222', '333'])
  })

  it('skips primary barcode and duplicates', () => {
    expect(parseCodigoAdicionalList('789,790,789', '789')).toEqual(['790'])
  })

  it('returns empty for blank', () => {
    expect(parseCodigoAdicionalList('')).toEqual([])
    expect(parseCodigoAdicionalList(null)).toEqual([])
  })
})
