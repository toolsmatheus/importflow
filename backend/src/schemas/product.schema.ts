import { z } from 'zod'

/**
 * Valores possíveis de listapiscofins no ToolsPharma.
 */
export const LISTA_PIS_COFINS = ['NEUTRA', 'POSITIVA', 'NEGATIVA'] as const

export const listaPisCofinsSchema = z.enum(LISTA_PIS_COFINS)

export const snSchema = z.enum(['S', 'N'])
export const ativoSchema = z.enum(['A', 'I'])

/** Cabeçalhos fixos do CSV modelo — nomes exatos que o usuário deve usar. */
export const REQUIRED_HEADERS = [
  'codigo',
  'nome',
  'codigogrupo',
  'custo',
  'markup',
  'venda',
  'fator',
  'listapiscofins',
  'aliquota',
  'cfop',
  'ncm',
  'cstpiscofins',
] as const

export const OPTIONAL_HEADERS = [
  'valorpmc',
  'codigobarras',
  'subgrupo',
  'categoria',
  'laboratorio',
  'grupodepreco',
  'similar',
  'estoque',
  'descontofixo',
  'comissao',
  'atualizaestoque',
  'demanda',
  'ativo',
  'st',
  'isento',
  'semincidencia',
  'permitedesconto',
  'localizacao',
  'usocontinuo',
  'observacao',
  'descontomax',
  'cest',
  'csosn',
  'csticms',
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

/**
 * Linha do CSV após parse (tudo string). A validação de negócio
 * (Etapa 2+) aplica coerção e regras cruzadas sobre este formato.
 */
export const productCsvRowSchema = z.object({
  codigo: z.string(),
  nome: z.string(),
  codigogrupo: z.string(),
  custo: z.string(),
  markup: z.string(),
  venda: z.string(),
  fator: z.string(),
  listapiscofins: z.string(),
  aliquota: z.string(),
  cfop: z.string(),
  ncm: z.string(),
  cstpiscofins: z.string(),
  valorpmc: z.string().optional(),
  codigobarras: z.string().optional(),
  subgrupo: z.string().optional(),
  categoria: z.string().optional(),
  laboratorio: z.string().optional(),
  grupodepreco: z.string().optional(),
  similar: z.string().optional(),
  estoque: z.string().optional(),
  descontofixo: z.string().optional(),
  comissao: z.string().optional(),
  atualizaestoque: z.string().optional(),
  demanda: z.string().optional(),
  ativo: z.string().optional(),
  st: z.string().optional(),
  isento: z.string().optional(),
  semincidencia: z.string().optional(),
  permitedesconto: z.string().optional(),
  localizacao: z.string().optional(),
  usocontinuo: z.string().optional(),
  observacao: z.string().optional(),
  descontomax: z.string().optional(),
  cest: z.string().optional(),
  csosn: z.string().optional(),
  csticms: z.string().optional(),
  medfciapop: z.string().optional(),
  qtdfciapop: z.string().optional(),
  valorfciapop: z.string().optional(),
  listacontrole: z.string().optional(),
  dcb: z.string().optional(),
  registroms: z.string().optional(),
  unidemb: z.string().optional(),
  unidadesngpc: z.string().optional(),
})

export type ProductCsvRow = z.infer<typeof productCsvRowSchema>

/** Arquivo auxiliar por entidade: grupo.csv, categoria.csv, etc. */
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

export const auxiliaryRowSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
})

export type AuxiliaryRow = z.infer<typeof auxiliaryRowSchema>

export const TEMPLATE_DELIMITER = ';'

/** Linha de exemplo do modelo CSV (todas as colunas do template). */
function buildExampleProductRow(values: {
  codigo: string
  nome: string
  codigogrupo: string
  custo: string
  markup: string
  venda: string
  fator?: string
  listapiscofins?: string
  aliquota?: string
  cfop?: string
  ncm?: string
  cstpiscofins?: string
  valorpmc?: string
  codigobarras?: string
  subgrupo?: string
  categoria?: string
  laboratorio?: string
  grupodepreco?: string
  similar?: string
  estoque?: string
  descontofixo?: string
  comissao?: string
  atualizaestoque?: string
  demanda?: string
  ativo?: string
  st?: string
  isento?: string
  semincidencia?: string
  permitedesconto?: string
  localizacao?: string
  usocontinuo?: string
  observacao?: string
  descontomax?: string
  cest?: string
  csosn?: string
  csticms?: string
  medfciapop?: string
  qtdfciapop?: string
  valorfciapop?: string
  listacontrole?: string
  dcb?: string
  registroms?: string
  unidemb?: string
  unidadesngpc?: string
}): string {
  const cols: Record<(typeof ALL_TEMPLATE_HEADERS)[number], string> = {
    codigo: values.codigo,
    nome: values.nome,
    codigogrupo: values.codigogrupo,
    custo: values.custo,
    markup: values.markup,
    venda: values.venda,
    fator: values.fator ?? '1',
    listapiscofins: values.listapiscofins ?? 'NEUTRA',
    aliquota: values.aliquota ?? '17',
    cfop: values.cfop ?? '5102',
    ncm: values.ncm ?? '30049099',
    cstpiscofins: values.cstpiscofins ?? '01',
    valorpmc: values.valorpmc ?? '',
    codigobarras: values.codigobarras ?? '',
    subgrupo: values.subgrupo ?? '',
    categoria: values.categoria ?? '',
    laboratorio: values.laboratorio ?? '',
    grupodepreco: values.grupodepreco ?? '',
    similar: values.similar ?? '',
    estoque: values.estoque ?? '10',
    descontofixo: values.descontofixo ?? '0',
    comissao: values.comissao ?? '0',
    atualizaestoque: values.atualizaestoque ?? 'S',
    demanda: values.demanda ?? '0',
    ativo: values.ativo ?? 'A',
    st: values.st ?? 'N',
    isento: values.isento ?? 'N',
    semincidencia: values.semincidencia ?? 'N',
    permitedesconto: values.permitedesconto ?? 'S',
    localizacao: values.localizacao ?? '',
    usocontinuo: values.usocontinuo ?? 'N',
    observacao: values.observacao ?? '',
    descontomax: values.descontomax ?? '10',
    cest: values.cest ?? '',
    csosn: values.csosn ?? '',
    csticms: values.csticms ?? '',
    medfciapop: values.medfciapop ?? 'N',
    qtdfciapop: values.qtdfciapop ?? '',
    valorfciapop: values.valorfciapop ?? '',
    listacontrole: values.listacontrole ?? '',
    dcb: values.dcb ?? '',
    registroms: values.registroms ?? '',
    unidemb: values.unidemb ?? '',
    unidadesngpc: values.unidadesngpc ?? '',
  }

  return ALL_TEMPLATE_HEADERS.map((h) => cols[h]).join(TEMPLATE_DELIMITER)
}

export function buildTemplateCsvContent(): string {
  const header = ALL_TEMPLATE_HEADERS.join(TEMPLATE_DELIMITER)

  const examples = [
    buildExampleProductRow({
      codigo: '10001',
      nome: 'Dipirona Sodica 500mg 10cp',
      codigogrupo: '1',
      custo: '4,50',
      markup: '100,00',
      venda: '9,00',
      listapiscofins: 'NEUTRA',
      aliquota: '17',
      valorpmc: '9,50',
      codigobarras: '7891058001155',
      subgrupo: '1',
      categoria: '1',
      laboratorio: '1',
      grupodepreco: '1',
      estoque: '40',
      localizacao: 'A1-P02',
      cest: '1300100',
      observacao: 'Exemplo aliquota NEUTRA',
    }),
    buildExampleProductRow({
      codigo: '10002',
      nome: 'Paracetamol 750mg 20cp',
      codigogrupo: '1',
      custo: '6,00',
      markup: '80,00',
      venda: '10,80',
      listapiscofins: 'POSITIVA',
      aliquota: '18',
      valorpmc: '11,50',
      codigobarras: '7898100244560',
      subgrupo: '1',
      categoria: '1',
      laboratorio: '1',
      grupodepreco: '1',
      cest: '1300100',
      observacao: 'Exemplo lista POSITIVA',
    }),
    buildExampleProductRow({
      codigo: '10003',
      nome: 'Ibuprofeno 600mg 10cp',
      codigogrupo: '1',
      custo: '8,50',
      markup: '70,00',
      venda: '14,45',
      listapiscofins: 'NEGATIVA',
      aliquota: '12',
      valorpmc: '15,90',
      codigobarras: '7897406121674',
      subgrupo: '1',
      categoria: '1',
      laboratorio: '2',
      grupodepreco: '1',
      cest: '1300100',
      observacao: 'Exemplo lista NEGATIVA',
    }),
    buildExampleProductRow({
      codigo: '10004',
      nome: 'Algodao Hidrofilo 100g',
      codigogrupo: '3',
      custo: '2,00',
      markup: '80,00',
      venda: '3,60',
      aliquota: '0',
      isento: 'S',
      st: 'N',
      ncm: '96190000',
      codigobarras: '7896004769011',
      subgrupo: '1',
      categoria: '2',
      laboratorio: '1',
      grupodepreco: '1',
      cest: '2003900',
      observacao: 'Exemplo isento',
    }),
    buildExampleProductRow({
      codigo: '10005',
      nome: 'Energetico Lata 269ml',
      codigogrupo: '3',
      custo: '3,00',
      markup: '40,00',
      venda: '4,20',
      aliquota: '0',
      st: 'S',
      isento: 'N',
      ncm: '22021000',
      codigobarras: '7896094921962',
      subgrupo: '1',
      categoria: '2',
      laboratorio: '1',
      grupodepreco: '1',
      cest: '0300100',
      observacao: 'Exemplo ST',
    }),
    buildExampleProductRow({
      codigo: '10006',
      nome: 'Losartana 50mg 30cp',
      codigogrupo: '1',
      custo: '7,00',
      markup: '60,00',
      venda: '11,20',
      aliquota: '17',
      codigobarras: '7897337707336',
      subgrupo: '1',
      categoria: '1',
      laboratorio: '1',
      grupodepreco: '1',
      usocontinuo: 'S',
      cest: '1300100',
      medfciapop: 'S',
      qtdfciapop: '30',
      valorfciapop: '5,50',
      observacao: 'Exemplo farmacia popular',
    }),
    buildExampleProductRow({
      codigo: '10007',
      nome: 'Clonazepam 2mg 30cp',
      codigogrupo: '1',
      custo: '15,80',
      markup: '87,00',
      venda: '29,55',
      aliquota: '17',
      codigobarras: '7891317008932',
      subgrupo: '1',
      categoria: '1',
      laboratorio: '1',
      grupodepreco: '1',
      cest: '1300100',
      listacontrole: 'B1',
      dcb: '4',
      registroms: '1004309710047',
      unidemb: '30',
      unidadesngpc: 'CAIXA',
      observacao: 'Exemplo controle especial B1',
    }),
    buildExampleProductRow({
      codigo: '10008',
      nome: 'Morfina 10mg ml',
      codigogrupo: '1',
      custo: '9,20',
      markup: '80,00',
      venda: '16,56',
      aliquota: '0',
      isento: 'S',
      st: 'N',
      codigobarras: '7896676402087',
      subgrupo: '1',
      categoria: '1',
      laboratorio: '1',
      grupodepreco: '1',
      cest: '1300100',
      listacontrole: 'A1',
      dcb: '10',
      registroms: '1029800970032',
      unidemb: '1',
      unidadesngpc: 'CAIXA',
      observacao: 'Exemplo controle especial A1',
    }),
    buildExampleProductRow({
      codigo: '10009',
      nome: 'Amoxicilina 500mg 21cp',
      codigogrupo: '1',
      custo: '9,00',
      markup: '55,00',
      venda: '13,95',
      aliquota: '17',
      codigobarras: '7891317001568',
      subgrupo: '2',
      categoria: '1',
      laboratorio: '2',
      grupodepreco: '1',
      cest: '1300100',
      listacontrole: 'T',
      dcb: '2',
      registroms: '1004307270023',
      unidemb: '21',
      unidadesngpc: 'CAIXA',
      observacao: 'Exemplo antibiotico lista T',
    }),
    buildExampleProductRow({
      codigo: '20001',
      nome: 'Protetor Solar FPS50 120ml',
      codigogrupo: '2',
      custo: '15,00',
      markup: '50,00',
      venda: '22,50',
      aliquota: '18',
      ncm: '33049990',
      codigobarras: '7891058017507',
      subgrupo: '1',
      categoria: '2',
      laboratorio: '2',
      grupodepreco: '2',
      cest: '2001900',
      observacao: 'Exemplo perfumaria',
    }),
  ]

  return `${header}\n${examples.join('\n')}\n`
}

export function buildAuxiliaryTemplateCsvContent(): string {
  return 'id;nome\n1;Exemplo\n'
}
