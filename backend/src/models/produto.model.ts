/**
 * Cabeçalhos e tipos de domínio do CSV de produtos (sem Zod / Fastify).
 */

export const LISTA_PIS_COFINS = ['NEUTRA', 'POSITIVA', 'NEGATIVA'] as const

export const REQUIRED_HEADERS = [
  'codigo',
  'nome',
  'codigogrupo',
  'custo',
  'venda',
  'listapiscofins',
  'aliquota',
  'ncm',
  'cstpiscofins',
] as const

/** Flags S/N: vazio ou ausente → S; só N no arquivo desliga. */
export const SN_DEFAULT_S_FIELDS = [
  'atualizaestoque',
  'atualizarpreco',
  'pagarpremicao',
  'permitedesconto',
] as const

export const OPTIONAL_HEADERS = [
  'markup',
  'fator',
  'cfop',
  'valorpmc',
  'tipopreco',
  'codigobarras',
  'codigoadicional',
  'subgrupo',
  'categoria',
  'laboratorio',
  'grupodepreco',
  'similar',
  'estoque',
  'estoqueminimo',
  'descontofixo',
  'comissao',
  'demanda',
  'ativo',
  'st',
  'isento',
  'semincidencia',
  'localizacao',
  'usocontinuo',
  'observacao',
  'descontomax',
  'cest',
  'csosn',
  'csticms',
  ...SN_DEFAULT_S_FIELDS,
] as const

export const FARMACIA_POPULAR_HEADERS = [
  'medfciapop',
  'qtdfciapop',
  'valorfciapop',
] as const

export const CONTROLADOS_HEADERS = [
  'listacontrole',
  'dcb',
  'registroms',
  'unidemb',
  'unidadesngpc',
] as const

export const ALL_TEMPLATE_HEADERS = [
  ...REQUIRED_HEADERS,
  ...OPTIONAL_HEADERS,
  ...FARMACIA_POPULAR_HEADERS,
  ...CONTROLADOS_HEADERS,
] as const

export type RequiredHeader = (typeof REQUIRED_HEADERS)[number]
export type OptionalHeader = (typeof OPTIONAL_HEADERS)[number]
export type ProductCsvHeader = (typeof ALL_TEMPLATE_HEADERS)[number]

/** Linha do CSV após parse (tudo string). */
export type ProductCsvRow = Record<ProductCsvHeader, string | undefined> & {
  codigo: string
  nome: string
  codigogrupo: string
  custo: string
  venda: string
  listapiscofins: string
  aliquota: string
  ncm: string
  cstpiscofins: string
  atualizaestoque?: string
  atualizarpreco?: string
  pagarpremicao?: string
  permitedesconto?: string
}

export const AUXILIARY_ENTITIES = [
  'grupo',
  'subgrupo',
  'categoria',
  'laboratorio',
  'grupodepreco',
  'similar',
  'dcb',
] as const

export type AuxiliaryEntity = (typeof AUXILIARY_ENTITIES)[number]

export type AuxiliaryRow = {
  id: string
  nome: string
}

export const TEMPLATE_DELIMITER = ';'

export const SN_FIELDS = [
  'atualizaestoque',
  'atualizarpreco',
  'pagarpremicao',
  'permitedesconto',
  'st',
  'isento',
  'semincidencia',
  'usocontinuo',
  'medfciapop',
] as const

export const INTEGER_OPTIONAL_FIELDS = [
  'subgrupo',
  'categoria',
  'laboratorio',
  'grupodepreco',
  'similar',
  'dcb',
] as const

export const DECIMAL_OPTIONAL_FIELDS = [
  'valorpmc',
  'estoque',
  'estoqueminimo',
  'descontofixo',
  'comissao',
  'demanda',
  'descontomax',
  'qtdfciapop',
  'valorfciapop',
] as const
