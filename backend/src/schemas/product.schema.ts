import { z } from 'zod'

/**
 * Valores possíveis de listapiscofins no ToolsPharma.
 * Ampliar conforme o cadastro oficial da filial/empresa.
 */
export const LISTA_PIS_COFINS = [
  'NEUTRA',
  'MONOFASICA',
  'ALIQUOTA_ZERO',
  'SUBSTITUICAO',
  'ISENTA',
] as const

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

/** Linha de exemplo sem farmácia popular nem controlados (medfciapop=N, listacontrole/dcb vazios). */
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
    cfop: values.cfop ?? '5405',
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
    csosn: values.csosn ?? '102',
    csticms: values.csticms ?? '',
    medfciapop: 'N',
    qtdfciapop: '',
    valorfciapop: '',
    listacontrole: '',
    dcb: '',
    registroms: '',
    unidemb: '',
    unidadesngpc: '',
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
      valorpmc: '9,50',
      codigobarras: '7891000100011',
      subgrupo: '1',
      categoria: '1',
      laboratorio: '1',
      grupodepreco: '1',
      estoque: '40',
      comissao: '3',
      demanda: '12',
      localizacao: 'A1-P02',
      cest: '1300100',
    }),
    buildExampleProductRow({
      codigo: '10002',
      nome: 'Paracetamol 750mg 20cp',
      codigogrupo: '1',
      custo: '6,00',
      markup: '80,00',
      venda: '10,80',
      valorpmc: '11,50',
      codigobarras: '7891000100028',
      subgrupo: '1',
      categoria: '1',
      laboratorio: '1',
      grupodepreco: '1',
      estoque: '55',
      comissao: '2',
      demanda: '20',
      localizacao: 'A1-P03',
      cest: '1300100',
    }),
    buildExampleProductRow({
      codigo: '10003',
      nome: 'Ibuprofeno 600mg 10cp',
      codigogrupo: '1',
      custo: '8,50',
      markup: '70,00',
      venda: '14,45',
      valorpmc: '15,90',
      codigobarras: '7891000100035',
      subgrupo: '1',
      categoria: '1',
      laboratorio: '2',
      grupodepreco: '1',
      estoque: '30',
      comissao: '3',
      demanda: '8',
      localizacao: 'A1-P04',
      cest: '1300100',
    }),
    buildExampleProductRow({
      codigo: '10004',
      nome: 'Omeprazol 20mg 28cp',
      codigogrupo: '1',
      custo: '12,00',
      markup: '60,00',
      venda: '19,20',
      valorpmc: '21,00',
      codigobarras: '7891000100042',
      subgrupo: '2',
      categoria: '1',
      laboratorio: '1',
      grupodepreco: '2',
      estoque: '22',
      comissao: '4',
      demanda: '6',
      localizacao: 'A2-P01',
      usocontinuo: 'S',
      cest: '1300100',
    }),
    buildExampleProductRow({
      codigo: '10005',
      nome: 'Amoxicilina 500mg 21cp',
      codigogrupo: '1',
      custo: '9,00',
      markup: '55,00',
      venda: '13,95',
      valorpmc: '14,90',
      codigobarras: '7891000100059',
      subgrupo: '2',
      categoria: '1',
      laboratorio: '2',
      grupodepreco: '1',
      estoque: '18',
      comissao: '3',
      demanda: '5',
      localizacao: 'A2-P02',
      cest: '1300100',
    }),
    buildExampleProductRow({
      codigo: '10006',
      nome: 'Vitamina C 500mg 30cp',
      codigogrupo: '1',
      custo: '5,00',
      markup: '75,00',
      venda: '8,75',
      valorpmc: '9,90',
      codigobarras: '7891000100066',
      subgrupo: '1',
      categoria: '2',
      laboratorio: '1',
      grupodepreco: '1',
      estoque: '60',
      comissao: '2',
      demanda: '15',
      localizacao: 'A3-P01',
      cest: '1300100',
    }),
    buildExampleProductRow({
      codigo: '10007',
      nome: 'Soro Fisiologico 0,9% 500ml',
      codigogrupo: '1',
      custo: '3,20',
      markup: '90,00',
      venda: '6,08',
      valorpmc: '6,50',
      codigobarras: '7891000100073',
      subgrupo: '1',
      categoria: '2',
      laboratorio: '2',
      grupodepreco: '1',
      estoque: '80',
      comissao: '1',
      demanda: '25',
      localizacao: 'A3-P05',
      cest: '1300100',
    }),
    buildExampleProductRow({
      codigo: '20001',
      nome: 'Protetor Solar FPS 50 120ml',
      codigogrupo: '2',
      custo: '15,00',
      markup: '50,00',
      venda: '22,50',
      valorpmc: '24,90',
      ncm: '33049990',
      codigobarras: '7891000100080',
      subgrupo: '1',
      categoria: '2',
      laboratorio: '2',
      grupodepreco: '2',
      estoque: '35',
      comissao: '5',
      demanda: '10',
      localizacao: 'B1-P01',
      cest: '2001900',
    }),
    buildExampleProductRow({
      codigo: '20002',
      nome: 'Shampoo Anticaspa 400ml',
      codigogrupo: '2',
      custo: '7,20',
      markup: '65,00',
      venda: '11,88',
      valorpmc: '12,90',
      ncm: '33051000',
      codigobarras: '7891000100097',
      subgrupo: '1',
      categoria: '2',
      laboratorio: '1',
      grupodepreco: '1',
      estoque: '48',
      comissao: '4',
      demanda: '14',
      localizacao: 'B1-P02',
      cest: '2001900',
    }),
    buildExampleProductRow({
      codigo: '30001',
      nome: 'Fralda Descartavel G 30un',
      codigogrupo: '3',
      custo: '22,00',
      markup: '40,00',
      venda: '30,80',
      valorpmc: '32,90',
      ncm: '96190000',
      codigobarras: '7891000100103',
      subgrupo: '1',
      categoria: '2',
      laboratorio: '1',
      grupodepreco: '2',
      estoque: '25',
      comissao: '3',
      demanda: '9',
      localizacao: 'C1-P01',
      fator: '1',
      cest: '2003900',
    }),
    buildExampleProductRow({
      codigo: '30002',
      nome: 'Absorvente Noturno 16un',
      codigogrupo: '3',
      custo: '4,80',
      markup: '85,00',
      venda: '8,88',
      valorpmc: '9,50',
      ncm: '96190000',
      codigobarras: '7891000100110',
      subgrupo: '1',
      categoria: '2',
      laboratorio: '2',
      grupodepreco: '1',
      estoque: '70',
      comissao: '2',
      demanda: '18',
      localizacao: 'C1-P02',
      cest: '2003900',
    }),
    buildExampleProductRow({
      codigo: '30003',
      nome: 'Algodao Hidrofilo 100g',
      codigogrupo: '3',
      custo: '2,50',
      markup: '100,00',
      venda: '5,00',
      valorpmc: '5,50',
      ncm: '30059090',
      codigobarras: '7891000100127',
      subgrupo: '1',
      categoria: '2',
      laboratorio: '1',
      grupodepreco: '1',
      estoque: '90',
      comissao: '1',
      demanda: '22',
      localizacao: 'C2-P01',
      cest: '2003900',
    }),
  ]

  return `${header}\n${examples.join('\n')}\n`
}

export function buildAuxiliaryTemplateCsvContent(): string {
  return 'id;nome\n1;Exemplo\n'
}
