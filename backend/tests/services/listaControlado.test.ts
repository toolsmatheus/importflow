import { describe, expect, it } from 'vitest'
import {
  isValidListaControladoCsv,
  mapListaControlado,
  normalizeListaControladoCode,
} from '@src/services/listaControlado.js'

describe('listaControlado', () => {
  it('mapeia códigos válidos do TMS', () => {
    expect(mapListaControlado('A1')).toEqual({ value: 'tlA1' })
    expect(mapListaControlado('tlC5')).toEqual({ value: 'tlC5' })
    expect(mapListaControlado('B2')).toEqual({ value: 'tlB2' })
    expect(mapListaControlado('')).toEqual({ value: 'tlNenhuma' })
    expect(mapListaControlado('T')).toEqual({ value: 'tlNenhuma' })
  })

  it('rejeita C3 e demais códigos inexistentes no enum TMS', () => {
    const c3 = mapListaControlado('C3')
    expect(c3.error).toMatch(/inválida/)
    expect(isValidListaControladoCsv('C3')).toBe(false)
    expect(isValidListaControladoCsv('D1')).toBe(false)
    expect(isValidListaControladoCsv('A1')).toBe(true)
    expect(isValidListaControladoCsv('T')).toBe(true)
  })

  it('normaliza prefixos', () => {
    expect(normalizeListaControladoCode('lista a1')).toBe('A1')
    expect(normalizeListaControladoCode('tlB1')).toBe('B1')
  })
})
