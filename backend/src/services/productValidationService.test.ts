import { describe, expect, it } from 'vitest'
import { validateProductRows } from './productValidationService.js'

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

describe('validateProductRows — alíquota zero', () => {
  it('exige st ou isento exclusivo quando alíquota=0', async () => {
    const result = await validateProductRows({
      rows: [baseRow({ aliquota: '0', st: 'N', isento: 'N' })],
    })

    const aliquotaErrors = result.issues.filter(
      (i) => i.field === 'aliquota' && i.severity === 'error'
    )
    expect(aliquotaErrors.some((i) => i.message.includes('exatamente uma'))).toBe(true)
  })

  it('aceita st=S quando alíquota=0', async () => {
    const result = await validateProductRows({
      rows: [baseRow({ aliquota: '0', st: 'S', isento: 'N' })],
    })

    const aliquotaErrors = result.issues.filter(
      (i) => i.field === 'aliquota' && i.severity === 'error'
    )
    expect(aliquotaErrors.some((i) => i.message.includes('exatamente uma'))).toBe(false)
  })
})

describe('validateProductRows — markup automático', () => {
  it('recalcula markup vazio com aviso', async () => {
    const result = await validateProductRows({
      rows: [baseRow({ markup: '' })],
    })

    expect(result.rows[0].markup).toBe('50,00')
    const warnings = result.issues.filter((i) => i.field === 'markup' && i.severity === 'warning')
    expect(warnings.some((i) => i.message.includes('recalculado'))).toBe(true)
  })
})

describe('validateProductRows — EAN', () => {
  it('emite warning para EAN inválido sem bloquear', async () => {
    const result = await validateProductRows({
      rows: [baseRow({ codigobarras: '7894900011510' })],
    })

    const eanWarnings = result.issues.filter(
      (i) => i.field === 'codigobarras' && i.severity === 'warning'
    )
    expect(eanWarnings.length).toBeGreaterThan(0)
  })
})
