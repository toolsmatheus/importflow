import { describe, expect, it } from 'vitest'
import type { ProductExistenceCatalogs } from './tmsTypes.js'
import { resolveProdutoIdFromCsv, usableMigracaoCodigo } from './tmsProductCatalog.js'

describe('usableMigracaoCodigo', () => {
  it('returns empty for zero migration code', () => {
    expect(usableMigracaoCodigo('0')).toBe('')
    expect(usableMigracaoCodigo(' 0 ')).toBe('')
  })

  it('keeps non-zero codes', () => {
    expect(usableMigracaoCodigo('1001')).toBe('1001')
  })

  it('returns empty for blank', () => {
    expect(usableMigracaoCodigo('')).toBe('')
    expect(usableMigracaoCodigo('   ')).toBe('')
  })
})

describe('resolveProdutoIdFromCsv', () => {
  const existence: ProductExistenceCatalogs = {
    byBarcode: new Map([['7891234567890', 50]]),
    byMigracao: new Map([['1001', 10], ['1002', 20]]),
    tipoclassesngpcById: new Map(),
    migracaoById: new Map(),
  }

  it('resolves by migration code first', () => {
    expect(resolveProdutoIdFromCsv(existence, '1001', '7891234567890')).toBe(10)
  })

  it('falls back to barcode when migration is zero', () => {
    expect(resolveProdutoIdFromCsv(existence, '0', '7891234567890')).toBe(50)
  })

  it('returns undefined when not found', () => {
    expect(resolveProdutoIdFromCsv(existence, '9999', '')).toBeUndefined()
  })
})
