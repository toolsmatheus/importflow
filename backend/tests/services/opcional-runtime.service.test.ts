import { describe, expect, it } from 'vitest'
import {
  MAX_STORED_OPTIONAL_ERRORS,
  MAX_STORED_OPTIONAL_SKIPPED,
  cell,
  parseOptionalCsvText,
  parsePositiveEstoque,
  parseValidityDate,
} from '@src/services/opcional-runtime.service.js'
import {
  parseBarcodeExtraCsvText,
  parseFatorCodigoBarra,
} from '@src/services/opcional-barras.service.js'

describe('opcionalJobRuntime helpers', () => {
  it('não limita erros/alertas armazenados a 200', () => {
    expect(MAX_STORED_OPTIONAL_ERRORS).toBeGreaterThan(200)
    expect(MAX_STORED_OPTIONAL_SKIPPED).toBeGreaterThan(200)
  })

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

describe('opcional barras adicionais', () => {
  it('parseBarcodeExtraCsvText aceita cabecalho codigo_migracao;codigobarra', () => {
    const rows = parseBarcodeExtraCsvText(
      'codigo_migracao;codigobarra;codigoadicional;fator\n1001;789;790;2\n'
    )
    expect(rows).toEqual([
      {
        codigo_migracao: '1001',
        codigobarra: '789',
        codigoadicional: '790',
        fator: '2',
      },
    ])
    expect(cell(rows[0], 'codigo_migracao', 'codigo')).toBe('1001')
    expect(cell(rows[0], 'codigobarra', 'codigobarras')).toBe('789')
  })

  it('parseFatorCodigoBarra: vazio → 1; rejeita decimal/negativo', () => {
    expect(parseFatorCodigoBarra('')).toBe(1)
    expect(parseFatorCodigoBarra('3')).toBe(3)
    expect(parseFatorCodigoBarra('0')).toBe(0)
    expect(parseFatorCodigoBarra('-1')).toBeNull()
    expect(parseFatorCodigoBarra('1,5')).toBeNull()
  })
})
