import { describe, expect, it } from 'vitest'
import {
  aliquotaMatchesUf,
  formatAliquotaCsv,
  getUfIcms,
  UF_ICMS_TABLE,
} from './icmsByUf.js'

describe('icmsByUf (fonte única)', () => {
  it('cobre as 27 UFs', () => {
    expect(UF_ICMS_TABLE).toHaveLength(27)
    const ufs = new Set(UF_ICMS_TABLE.map((e) => e.uf))
    expect(ufs.size).toBe(27)
  })

  it('getUfIcms é case-insensitive', () => {
    expect(getUfIcms('sp')?.aliquota).toBe(18)
    expect(getUfIcms('SP')?.name).toBe('São Paulo')
  })

  it('formatAliquotaCsv usa vírgula decimal', () => {
    expect(formatAliquotaCsv(18)).toBe('18')
    expect(formatAliquotaCsv(21.5)).toBe('21,50')
  })

  it('aliquotaMatchesUf respeita tolerância e ignora ≤0', () => {
    expect(aliquotaMatchesUf(18, 'SP')).toBe(true)
    expect(aliquotaMatchesUf(18.0005, 'SP')).toBe(true)
    expect(aliquotaMatchesUf(19, 'SP')).toBe(false)
    expect(aliquotaMatchesUf(0, 'SP')).toBe(true)
  })
})
