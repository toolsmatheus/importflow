/** Alíquota ICMS interna padrão por UF (percentual total, incl. FECP/FECOEP quando aplicável). */
export type BrazilianUf =
  | 'AC'
  | 'AL'
  | 'AP'
  | 'AM'
  | 'BA'
  | 'CE'
  | 'DF'
  | 'ES'
  | 'GO'
  | 'MA'
  | 'MT'
  | 'MS'
  | 'MG'
  | 'PA'
  | 'PB'
  | 'PR'
  | 'PE'
  | 'PI'
  | 'RJ'
  | 'RN'
  | 'RS'
  | 'RO'
  | 'RR'
  | 'SC'
  | 'SP'
  | 'SE'
  | 'TO'

export interface UfIcmsEntry {
  uf: BrazilianUf
  name: string
  aliquota: number
  note?: string
}

export const UF_ICMS_TABLE: UfIcmsEntry[] = [
  { uf: 'AC', name: 'Acre', aliquota: 19 },
  { uf: 'AL', name: 'Alagoas', aliquota: 21.5, note: '20,50% ICMS + 1% FECOEP' },
  { uf: 'AP', name: 'Amapá', aliquota: 18 },
  { uf: 'AM', name: 'Amazonas', aliquota: 20 },
  { uf: 'BA', name: 'Bahia', aliquota: 20.5 },
  { uf: 'CE', name: 'Ceará', aliquota: 20 },
  { uf: 'DF', name: 'Distrito Federal', aliquota: 20 },
  { uf: 'ES', name: 'Espírito Santo', aliquota: 17 },
  { uf: 'GO', name: 'Goiás', aliquota: 19 },
  { uf: 'MA', name: 'Maranhão', aliquota: 23 },
  { uf: 'MT', name: 'Mato Grosso', aliquota: 17 },
  { uf: 'MS', name: 'Mato Grosso do Sul', aliquota: 17 },
  { uf: 'MG', name: 'Minas Gerais', aliquota: 18 },
  { uf: 'PA', name: 'Pará', aliquota: 19 },
  { uf: 'PB', name: 'Paraíba', aliquota: 20 },
  { uf: 'PR', name: 'Paraná', aliquota: 19.5 },
  { uf: 'PE', name: 'Pernambuco', aliquota: 20.5 },
  { uf: 'PI', name: 'Piauí', aliquota: 22.5 },
  { uf: 'RJ', name: 'Rio de Janeiro', aliquota: 22, note: '20% + 2% FECP' },
  { uf: 'RN', name: 'Rio Grande do Norte', aliquota: 20 },
  { uf: 'RS', name: 'Rio Grande do Sul', aliquota: 17 },
  { uf: 'RO', name: 'Rondônia', aliquota: 19.5 },
  { uf: 'RR', name: 'Roraima', aliquota: 20 },
  { uf: 'SC', name: 'Santa Catarina', aliquota: 17 },
  { uf: 'SP', name: 'São Paulo', aliquota: 18 },
  { uf: 'SE', name: 'Sergipe', aliquota: 20, note: '19% + 1% FECOEP' },
  { uf: 'TO', name: 'Tocantins', aliquota: 20 },
]

const byUf = new Map(UF_ICMS_TABLE.map((e) => [e.uf, e]))

export function getUfIcms(uf: string): UfIcmsEntry | null {
  return byUf.get(uf.toUpperCase() as BrazilianUf) ?? null
}

export function formatAliquotaCsv(value: number): string {
  if (!Number.isFinite(value)) return ''
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(2).replace('.', ',')
}

const TOLERANCE = 0.001

export function aliquotaMatchesUf(aliquota: number, uf: string): boolean {
  const entry = getUfIcms(uf)
  if (!entry) return true
  if (!Number.isFinite(aliquota) || aliquota <= 0) return true
  return Math.abs(aliquota - entry.aliquota) <= TOLERANCE
}
