import { describe, expect, it } from 'vitest'
import {
  claimExistenceKey,
  confirmExistenceKey,
  lookupExistenceId,
  releaseExistenceKey,
} from '../send/sendJobExistence.js'

describe('sendJobExistence', () => {
  it('lookup encontra chave numérica normalizada', () => {
    const map = new Map<string, number>([['42', 7]])
    expect(lookupExistenceId(map, '42')).toBe(7)
    expect(lookupExistenceId(map, ' 42 ')).toBe(7)
    expect(lookupExistenceId(map, '99')).toBeUndefined()
  })

  it('claim reserva e impede duplicata; release só remove placeholder', () => {
    const map = new Map<string, number>()
    expect(claimExistenceKey(map, '100')).toBe(true)
    expect(claimExistenceKey(map, '100')).toBe(false)
    releaseExistenceKey(map, '100')
    expect(lookupExistenceId(map, '100')).toBeUndefined()

    claimExistenceKey(map, '200')
    confirmExistenceKey(map, '200', 55)
    releaseExistenceKey(map, '200')
    expect(lookupExistenceId(map, '200')).toBe(55)
  })
})
