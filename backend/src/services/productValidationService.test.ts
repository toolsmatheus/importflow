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
    atualizaestoque: 'S',
    atualizarpreco: 'S',
    pagarpremicao: 'N',
    permitedesconto: 'S',
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

  it('com alíquota > 0 não exige cruzamento st/isento', async () => {
    const result = await validateProductRows({
      rows: [baseRow({ aliquota: '18', st: 'S', isento: 'S' })],
    })

    const stIsentoErrors = result.issues.filter(
      (i) =>
        i.severity === 'error' &&
        (i.message.includes('st e isento') || i.message.includes('exatamente uma'))
    )
    expect(stIsentoErrors).toHaveLength(0)
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

  it('avisa quando custo é maior que a venda sem bloquear', async () => {
    const result = await validateProductRows({
      rows: [baseRow({ custo: '20,00', venda: '15,00', markup: '' })],
    })

    const warnings = result.issues.filter(
      (i) => i.severity === 'warning' && i.message.toLowerCase().includes('maior que a venda')
    )
    expect(warnings.length).toBeGreaterThan(0)
    expect(result.issues.some((i) => i.field === 'custo' && i.severity === 'error')).toBe(false)
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

describe('validateProductRows — controlado anulado', () => {
  it('limpa lista/DCB/MS com aviso quando DCB não existe', async () => {
    const result = await validateProductRows({
      rows: [
        baseRow({
          listacontrole: 'A1',
          dcb: '10021',
          registroms: '1234567890',
        }),
      ],
    })

    const row = result.rows[0]
    expect(row.listacontrole).toBe('')
    expect(row.dcb).toBe('')
    expect(row.registroms).toBe('')

    const cleared = result.issues.filter(
      (i) => i.severity === 'warning' && i.message.toLowerCase().includes('controlado anulado')
    )
    expect(cleared.length).toBeGreaterThan(0)

    const blockingDcb = result.issues.filter(
      (i) =>
        i.field === 'dcb' &&
        i.severity === 'error' &&
        i.message.toLowerCase().includes('não encontrado')
    )
    expect(blockingDcb).toHaveLength(0)
  })
})
