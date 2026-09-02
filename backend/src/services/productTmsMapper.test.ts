import { describe, expect, it } from 'vitest'
import type { ProductLookupCatalogs } from './productTmsMapper.js'
import { mapCsvRowToProductPayload } from './productTmsMapper.js'

function emptyMaps(): ProductLookupCatalogs {
  return {
    grupoByMigracao: new Map(),
    subgrupoByMigracao: new Map(),
    categoriaByMigracao: new Map(),
    laboratorioByMigracao: new Map(),
    grupodeprecoByMigracao: new Map(),
    similarByDescricao: new Map(),
    similarCodigoToDescricao: new Map(),
    dcbByCode: new Map(),
    dcbByDescricao: new Map(),
    dcbCodigoToDescricao: new Map(),
    unidadeUnId: 600,
    aliquotaByPercent: new Map(),
    aliquotaStId: 100,
    aliquotaIsentoId: 400,
    cfopByCode: new Map(),
  }
}

function baseCatalogs(overrides: Partial<ProductLookupCatalogs> = {}): ProductLookupCatalogs {
  const base = emptyMaps()
  base.grupoByMigracao.set('1', 11)
  base.aliquotaByPercent.set(18, 200)
  base.cfopByCode.set('5102', 2300)
  base.cfopByCode.set('5405', 2400)
  return { ...base, ...overrides }
}

function baseRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    codigo: '1001',
    nome: 'Produto Teste',
    codigogrupo: '1',
    custo: '10,00',
    venda: '15,00',
    fator: '1',
    listapiscofins: 'NEUTRA',
    aliquota: '18',
    ncm: '30049099',
    cstpiscofins: '04',
    ...overrides,
  }
}

describe('mapCsvRowToProductPayload — CFOP automático', () => {
  it('aplica CFOP 5102 e CST quando alíquota > 0', () => {
    const result = mapCsvRowToProductPayload(baseRow(), 1, baseCatalogs())
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.payload['cfopvenda@xdata.ref']).toBe('CFOP(2300)')
    expect(result.payload.csticms).toBe('cic102')
    expect(result.payload.csticmsnormal).toBe('cic00')
  })

  it('aplica CFOP 5405 e CST ST quando st=S', () => {
    const result = mapCsvRowToProductPayload(
      baseRow({ aliquota: '0', st: 'S', isento: 'N' }),
      1,
      baseCatalogs()
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.payload['cfopvenda@xdata.ref']).toBe('CFOP(2400)')
    expect(result.payload.csticms).toBe('cic500')
    expect(result.payload.csticmsnormal).toBe('cic60')
    expect(result.payload['aliquotaicms@xdata.ref']).toBe('AliquotaICMS(100)')
  })

  it('aplica CST isento quando alíquota=0 e isento=S', () => {
    const result = mapCsvRowToProductPayload(
      baseRow({ aliquota: '0', st: 'N', isento: 'S' }),
      1,
      baseCatalogs()
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.payload['cfopvenda@xdata.ref']).toBeUndefined()
    expect(result.payload.csticmsnormal).toBe('cic40')
    expect(result.payload['aliquotaicms@xdata.ref']).toBe('AliquotaICMS(400)')
  })

  it('rejeita alíquota=0 sem st/isento exclusivo', () => {
    const bothOff = mapCsvRowToProductPayload(
      baseRow({ aliquota: '0', st: 'N', isento: 'N' }),
      1,
      baseCatalogs()
    )
    expect(bothOff.ok).toBe(false)
    if (bothOff.ok) return
    expect(bothOff.message).toContain('aliquota=0')

    const bothOn = mapCsvRowToProductPayload(
      baseRow({ aliquota: '0', st: 'S', isento: 'S' }),
      1,
      baseCatalogs()
    )
    expect(bothOn.ok).toBe(false)
  })
})

describe('mapCsvRowToProductPayload — markup', () => {
  it('recalcula markup inconsistente a partir de custo/venda', () => {
    const result = mapCsvRowToProductPayload(
      baseRow({ markup: '10', custo: '10,00', venda: '15,00' }),
      1,
      baseCatalogs()
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.payload.margemLucro).toBe(50)
  })
})
