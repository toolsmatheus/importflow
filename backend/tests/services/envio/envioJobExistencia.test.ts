import { describe, expect, it } from 'vitest'
import {
  reivindicarChaveExistencia,
  confirmarChaveExistencia,
  buscarIdExistencia,
  liberarChaveExistencia,
} from '@src/services/envio/envioJobExistencia.js'

describe('envioJobExistencia', () => {
  it('lookup encontra chave numérica normalizada', () => {
    const map = new Map<string, number>([['42', 7]])
    expect(buscarIdExistencia(map, '42')).toBe(7)
    expect(buscarIdExistencia(map, ' 42 ')).toBe(7)
    expect(buscarIdExistencia(map, '99')).toBeUndefined()
  })

  it('claim reserva e impede duplicata; release só remove placeholder', () => {
    const map = new Map<string, number>()
    expect(reivindicarChaveExistencia(map, '100')).toBe(true)
    expect(reivindicarChaveExistencia(map, '100')).toBe(false)
    liberarChaveExistencia(map, '100')
    expect(buscarIdExistencia(map, '100')).toBeUndefined()

    reivindicarChaveExistencia(map, '200')
    confirmarChaveExistencia(map, '200', 55)
    liberarChaveExistencia(map, '200')
    expect(buscarIdExistencia(map, '200')).toBe(55)
  })
})
