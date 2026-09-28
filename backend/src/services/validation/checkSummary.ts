import type {
  IssueSeverity,
  ValidationCheckSummaryItem,
  ValidationIssue,
} from './types.js'

/** Ordem fixa do checklist — o que o sistema realmente pesquisa. */
export const VALIDATION_CHECK_DEFS: Array<{
  id: string
  label: string
  severity: IssueSeverity
  match: (issue: ValidationIssue) => boolean
}> = [
  {
    id: 'invalid_barcode',
    label: 'Códigos de barras inválidos (EAN)',
    severity: 'warning',
    match: (i) =>
      (i.field === 'codigobarras' || i.field === 'codigoadicional') &&
      (i.message.toLowerCase().includes('dígito verificador') ||
        i.message.toLowerCase().includes('tamanho inválido') ||
        i.message.toLowerCase().includes('código de barras inválido')),
  },
  {
    id: 'missing_barcode',
    label: 'Produtos sem código de barras',
    severity: 'warning',
    match: (i) =>
      i.field === 'codigobarras' &&
      i.severity === 'warning' &&
      i.message.toLowerCase().includes('sem código de barras'),
  },
  {
    id: 'duplicate_codigo',
    label: 'Códigos duplicados no arquivo',
    severity: 'error',
    match: (i) => i.field === 'codigo' && i.message.toLowerCase().includes('duplicado'),
  },
  {
    id: 'duplicate_barcode',
    label: 'Códigos de barras duplicados no arquivo',
    severity: 'error',
    match: (i) =>
      (i.field === 'codigobarras' || i.field === 'codigoadicional') &&
      i.message.toLowerCase().includes('duplicado') &&
      !i.message.toLowerCase().includes('mesma linha'),
  },
  {
    id: 'barcode_adicional_conflict',
    label: 'Código adicional conflita com EAN principal / repetido na linha',
    severity: 'warning',
    match: (i) =>
      i.field === 'codigoadicional' &&
      (i.message.toLowerCase().includes('igual ao ean principal') ||
        i.message.toLowerCase().includes('mesma linha')),
  },
  {
    id: 'invalid_codigo',
    label: 'Códigos com letras (migração)',
    severity: 'error',
    match: (i) => i.field === 'codigo' && i.message.toLowerCase().includes('letras'),
  },
  {
    id: 'lista_controlado_invalid',
    label: 'Lista de controle inválida no TMS',
    severity: 'error',
    match: (i) =>
      i.field === 'listacontrole' &&
      i.message.toLowerCase().includes('lista de controle inválida'),
  },
  {
    id: 'controlado_incomplete',
    label: 'Controlados incompletos (DCB / registro MS)',
    severity: 'error',
    match: (i) =>
      (i.field === 'dcb' || i.field === 'registroms') &&
      i.message.toLowerCase().includes('controlado') &&
      !i.message.toLowerCase().includes('anulado'),
  },
  {
    id: 'controlado_cleared',
    label: 'Controlado anulado (DCB não encontrado)',
    severity: 'warning',
    match: (i) => i.message.toLowerCase().includes('controlado anulado'),
  },
  {
    id: 'dcb_invalid',
    label: 'DCB não encontrado (auxiliar / banco / Anvisa)',
    severity: 'warning',
    match: (i) =>
      i.field === 'dcb' &&
      !i.message.toLowerCase().includes('controlado') &&
      (i.message.toLowerCase().includes('não encontrado') ||
        i.message.toLowerCase().includes('não foi possível validar')),
  },
  {
    id: 'aux_ref_invalid',
    label: 'Referências auxiliares inválidas',
    severity: 'error',
    match: (i) =>
      ['codigogrupo', 'subgrupo', 'categoria', 'laboratorio', 'grupodepreco', 'similar'].includes(
        i.field
      ) ||
      (['grupo', 'subgrupo', 'categoria', 'laboratorio', 'grupodepreco', 'similar'].includes(
        i.field
      ) &&
        (i.message.toLowerCase().includes('não encontrado') ||
          i.message.toLowerCase().includes('envie o arquivo auxiliar'))),
  },
  {
    id: 'missing_required_header',
    label: 'Colunas obrigatórias ausentes',
    severity: 'error',
    match: (i) => i.message.includes('Coluna obrigatória ausente'),
  },
  {
    id: 'missing_required_field',
    label: 'Campos obrigatórios em branco',
    severity: 'error',
    match: (i) => i.message.includes('Campo obrigatório não informado'),
  },
  {
    id: 'invalid_format',
    label: 'Formatos inválidos (nome, números, CFOP, NCM, S/N…)',
    severity: 'error',
    match: (i) =>
      i.message.includes('Valor numérico inválido') ||
      i.message.includes('número inteiro') ||
      i.message.includes('CFOP') ||
      i.message.includes('NCM') ||
      i.message.includes('S ou N') ||
      i.message.includes('A (ativo)') ||
      i.message.includes('somente números') ||
      i.message.includes('Opções:') ||
      i.message.includes('Obrigatório quando medfciapop'),
  },
  {
    id: 'aliquota_rules',
    label: 'Regras de alíquota / ST / isento / sem incidência',
    severity: 'error',
    match: (i) =>
      i.severity === 'error' &&
      ((i.field === 'aliquota' && !i.message.includes('padrão da UF')) ||
        i.field === 'st' ||
        i.field === 'isento' ||
        i.field === 'semincidencia' ||
        i.message.includes('st e isento') ||
        i.message.includes('semincidencia')),
  },
  {
    id: 'aliquota_st_default',
    label: 'Alíquota 0 sem flag — ST definido automaticamente',
    severity: 'warning',
    match: (i) =>
      i.severity === 'warning' &&
      (i.field === 'st' || i.field === 'aliquota') &&
      i.message.includes('definido automaticamente como ST'),
  },
  {
    id: 'aliquota_uf',
    label: 'Alíquota divergente da UF do cliente',
    severity: 'warning',
    match: (i) => i.field === 'aliquota' && i.message.includes('padrão da UF'),
  },
  {
    id: 'desconto_inconsistente',
    label: 'Desconto fixo maior que o máximo',
    severity: 'warning',
    match: (i) => i.field === 'descontofixo',
  },
  {
    id: 'custo_maior_venda',
    label: 'Custo maior que a venda',
    severity: 'warning',
    match: (i) =>
      (i.field === 'custo' || i.field === 'venda') &&
      i.message.toLowerCase().includes('custo') &&
      i.message.toLowerCase().includes('venda') &&
      i.severity === 'warning',
  },
  {
    id: 'markup_auto',
    label: 'Markup recalculado (custo × venda)',
    severity: 'warning',
    match: (i) => i.field === 'markup' && i.severity === 'warning',
  },
  {
    id: 'unknown_headers',
    label: 'Colunas não reconhecidas no CSV',
    severity: 'warning',
    match: (i) => i.message.includes('não reconhecida'),
  },
  {
    id: 'other_error',
    label: 'Outras inconsistências (erros)',
    severity: 'error',
    match: (i) => i.severity === 'error',
  },
  {
    id: 'other_warning',
    label: 'Outras inconsistências (alertas)',
    severity: 'warning',
    match: (i) => i.severity === 'warning',
  },
]

export function classifyIssue(issue: ValidationIssue): string {
  for (const def of VALIDATION_CHECK_DEFS) {
    if (def.id === 'other_error' || def.id === 'other_warning') continue
    if (def.match(issue)) return def.id
  }
  return issue.severity === 'warning' ? 'other_warning' : 'other_error'
}

export function buildCheckSummary(
  categoryCounts: Map<string, number>
): ValidationCheckSummaryItem[] {
  return VALIDATION_CHECK_DEFS.filter((def) => {
    if (def.id === 'other_error' || def.id === 'other_warning') {
      return (categoryCounts.get(def.id) ?? 0) > 0
    }
    return true
  }).map((def) => ({
    id: def.id,
    label: def.label,
    count: categoryCounts.get(def.id) ?? 0,
    severity: def.severity,
  }))
}

