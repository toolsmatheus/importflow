import { describe, expect, it } from 'vitest'
import { parseImportarListaResponse } from './tmsProductImport.js'

describe('parseImportarListaResponse', () => {
  it('returns empty for blank input', () => {
    expect(parseImportarListaResponse()).toEqual({ itemErrors: [] })
    expect(parseImportarListaResponse('')).toEqual({ itemErrors: [] })
  })

  it('parses per-item migration errors from plain text', () => {
    const raw = [
      'Erro ao salvar cód. migração 1001: Grupo inválido',
      'Erro ao salvar cód. migração 1002: NCM obrigatório',
    ].join('\n')

    const result = parseImportarListaResponse(raw)
    expect(result.itemErrors).toEqual([
      { codigoMigracao: '1001', message: 'Grupo inválido' },
      { codigoMigracao: '1002', message: 'NCM obrigatório' },
    ])
    expect(result.globalError).toBeUndefined()
  })

  it('unwraps JSON value wrapper', () => {
    const raw = JSON.stringify({
      value: 'Erro ao salvar cód. migração 42: Duplicado',
    })

    expect(parseImportarListaResponse(raw).itemErrors).toEqual([
      { codigoMigracao: '42', message: 'Duplicado' },
    ])
  })

  it('returns global error from JSON error envelope', () => {
    const raw = JSON.stringify({ error: { message: 'Serviço indisponível' } })

    expect(parseImportarListaResponse(raw)).toEqual({
      itemErrors: [],
      globalError: 'Serviço indisponível',
    })
  })

  it('returns global error when text mentions erro without line matches', () => {
    const result = parseImportarListaResponse('Erro interno no servidor')
    expect(result.itemErrors).toEqual([])
    expect(result.globalError).toBe('Erro interno no servidor')
  })

  it('treats success-like empty value as no errors', () => {
    expect(parseImportarListaResponse(JSON.stringify({ value: '' }))).toEqual({
      itemErrors: [],
    })
  })
})
