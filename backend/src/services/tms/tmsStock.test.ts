import { describe, expect, it } from 'vitest'
import { parseKeyQtyBlock } from './tmsStock.js'

describe('parseKeyQtyBlock', () => {
  it('parses EAN lines', () => {
    expect(parseKeyQtyBlock('7891234567890;16')).toEqual([
      { key: '7891234567890', quantidade: 16 },
    ])
  })

  it('accepts codigo_migracao 0 as key', () => {
    expect(parseKeyQtyBlock('0;16')).toEqual([{ key: '0', quantidade: 16 }])
  })

  it('ignores zero quantity and empty keys', () => {
    expect(parseKeyQtyBlock('0;0')).toEqual([])
    expect(parseKeyQtyBlock(';5')).toEqual([])
  })

  it('parses multiline blocks', () => {
    const raw = '789111;10\r\n789222;5'
    expect(parseKeyQtyBlock(raw)).toEqual([
      { key: '789111', quantidade: 10 },
      { key: '789222', quantidade: 5 },
    ])
  })

  it('accepts comma decimal separator', () => {
    expect(parseKeyQtyBlock('789111;10,5')).toEqual([
      { key: '789111', quantidade: 10.5 },
    ])
  })
})
