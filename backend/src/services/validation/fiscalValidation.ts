import { LISTA_PIS_COFINS } from '../../schemas/product.schema.js'
import {
  isBlank,
  isValidCfop,
  isValidNcm,
  computeMarkupFromCustoVenda,
  formatBrazilianDecimal,
  markupMatchesSale,
  parseBrazilianNumber,
} from '../../utils/productFormats.js'
import {
  aliquotaMatchesUf,
  formatAliquotaCsv,
  getUfIcms,
} from '../../utils/icmsByUf.js'
import { pushIssue } from './counters.js'
import { cell, hasColumn, type IssueCounters, type ValidationIssue } from './types.js'

/** Custo/markup/venda, fator, alíquota/ST, PIS/COFINS, CFOP, NCM e descontos. */
export function validateFiscalAndPricing(
  record: Record<string, string>,
  rowNumber: number,
  columns: Set<string>,
  issues: ValidationIssue[],
  counters: IssueCounters,
  clientUf?: string
) {
  const custoRaw = cell(record, 'custo')
  const markupRaw = cell(record, 'markup')
  const vendaRaw = cell(record, 'venda')
  const fatorRaw = cell(record, 'fator')
  const aliquotaRaw = cell(record, 'aliquota')

  const custo = !isBlank(custoRaw) ? parseBrazilianNumber(custoRaw) : null
  const markup = !isBlank(markupRaw) ? parseBrazilianNumber(markupRaw) : null
  const venda = !isBlank(vendaRaw) ? parseBrazilianNumber(vendaRaw) : null

  if (!isBlank(custoRaw) && custo === null) {
    pushIssue(issues, counters, {
      row: rowNumber,
      field: 'custo',
      value: custoRaw,
      message: 'Valor numérico inválido.',
      severity: 'error',
    })
  }
  if (!isBlank(vendaRaw) && venda === null) {
    pushIssue(issues, counters, {
      row: rowNumber,
      field: 'venda',
      value: vendaRaw,
      message: 'Valor numérico inválido.',
      severity: 'error',
    })
  }

  if (custo !== null && venda !== null && custo > venda) {
    pushIssue(issues, counters, {
      row: rowNumber,
      field: 'custo',
      value: custoRaw,
      message: `Custo (${formatBrazilianDecimal(custo)}) é maior que a venda (${formatBrazilianDecimal(venda)}).`,
      severity: 'warning',
    })
  }

  const computedMarkup =
    custo !== null && venda !== null ? computeMarkupFromCustoVenda(custo, venda) : null
  const markupBlank = isBlank(markupRaw)
  const markupInvalid = !markupBlank && markup === null
  const markupMismatch =
    markup !== null &&
    custo !== null &&
    venda !== null &&
    !markupMatchesSale(custo, markup, venda)

  if (computedMarkup !== null && (markupBlank || markupInvalid || markupMismatch)) {
    const formatted = formatBrazilianDecimal(computedMarkup)
    record.markup = formatted
    const reason = markupBlank
      ? 'Markup vazio'
      : markupInvalid
        ? 'Markup inválido'
        : 'Markup inconsistente com custo/venda'
    pushIssue(issues, counters, {
      row: rowNumber,
      field: 'markup',
      value: markupRaw,
      message: `${reason} — recalculado para ${formatted} (venda = custo × (1 + markup/100)).`,
      severity: 'warning',
    })
  } else if (markupBlank || markupInvalid) {
    pushIssue(issues, counters, {
      row: rowNumber,
      field: 'markup',
      value: markupRaw,
      message: markupBlank
        ? 'Markup não informado e não foi possível recalcular (informe custo e venda válidos, custo ≠ 0).'
        : 'Valor numérico inválido e não foi possível recalcular (informe custo e venda válidos, custo ≠ 0).',
      severity: 'error',
    })
  }

  if (isBlank(fatorRaw)) {
    record.fator = '1'
  } else if (parseBrazilianNumber(fatorRaw) === null) {
    pushIssue(issues, counters, {
      row: rowNumber,
      field: 'fator',
      value: fatorRaw,
      message: 'Valor numérico inválido.',
      severity: 'error',
    })
  }
  if (!isBlank(aliquotaRaw) && parseBrazilianNumber(aliquotaRaw) === null) {
    pushIssue(issues, counters, {
      row: rowNumber,
      field: 'aliquota',
      value: aliquotaRaw,
      message: 'Valor numérico inválido.',
      severity: 'error',
    })
  }

  const aliquotaNum = !isBlank(aliquotaRaw) ? parseBrazilianNumber(aliquotaRaw) : null
  if (aliquotaNum === 0) {
    const stOn = cell(record, 'st').trim().toUpperCase() === 'S'
    const isentoOn = cell(record, 'isento').trim().toUpperCase() === 'S'
    const semIncidenciaOn = cell(record, 'semincidencia').trim().toUpperCase() === 'S'
    const zeroFlagsOn = [stOn, isentoOn, semIncidenciaOn].filter(Boolean).length
    if (zeroFlagsOn === 0) {
      const previousSt = cell(record, 'st')
      record.st = 'S'
      if (hasColumn(columns, 'isento') && isBlank(cell(record, 'isento'))) {
        record.isento = 'N'
      }
      if (hasColumn(columns, 'semincidencia') && isBlank(cell(record, 'semincidencia'))) {
        record.semincidencia = 'N'
      }
      pushIssue(issues, counters, {
        row: rowNumber,
        field: 'st',
        value: previousSt,
        message:
          'Quando aliquota=0 sem st/isento/semincidencia, st foi definido automaticamente como ST (S).',
        severity: 'warning',
      })
    } else if (zeroFlagsOn > 1) {
      pushIssue(issues, counters, {
        row: rowNumber,
        field: 'aliquota',
        value: aliquotaRaw,
        message:
          'Quando aliquota=0, exatamente uma coluna deve ser S: st, isento ou semincidencia.',
        severity: 'error',
      })
    }
  } else if (
    aliquotaNum !== null &&
    aliquotaNum > 0 &&
    clientUf &&
    !aliquotaMatchesUf(aliquotaNum, clientUf)
  ) {
    const entry = getUfIcms(clientUf)
    const expected = entry ? formatAliquotaCsv(entry.aliquota) : '?'
    pushIssue(issues, counters, {
      row: rowNumber,
      field: 'aliquota',
      value: aliquotaRaw,
      message: `Alíquota diferente da padrão da UF ${clientUf} (esperada ${expected}%).`,
      severity: 'warning',
    })
  }

  const lista = cell(record, 'listapiscofins').trim().toUpperCase()
  if (lista && !(LISTA_PIS_COFINS as readonly string[]).includes(lista)) {
    pushIssue(issues, counters, {
      row: rowNumber,
      field: 'listapiscofins',
      value: cell(record, 'listapiscofins'),
      message: `Valor inválido. Opções: ${LISTA_PIS_COFINS.join(', ')}.`,
      severity: 'error',
    })
  }

  const cfop = cell(record, 'cfop').trim()
  if (cfop && !isValidCfop(cfop)) {
    pushIssue(issues, counters, {
      row: rowNumber,
      field: 'cfop',
      value: cfop,
      message: 'CFOP deve ter exatamente 4 dígitos numéricos.',
      severity: 'error',
    })
  }

  const ncm = cell(record, 'ncm').trim()
  if (ncm && !isValidNcm(ncm)) {
    pushIssue(issues, counters, {
      row: rowNumber,
      field: 'ncm',
      value: ncm,
      message: 'NCM deve ter exatamente 8 dígitos numéricos.',
      severity: 'error',
    })
  }

  // st/isento/semincidencia só cruzados quando aliquota=0. Com alíquota > 0, usa-se a alíquota.

  if (hasColumn(columns, 'descontofixo') && hasColumn(columns, 'descontomax')) {
    const fixo = parseBrazilianNumber(cell(record, 'descontofixo'))
    const max = parseBrazilianNumber(cell(record, 'descontomax'))
    if (fixo !== null && max !== null && fixo > max) {
      pushIssue(issues, counters, {
        row: rowNumber,
        field: 'descontofixo',
        value: cell(record, 'descontofixo'),
        message: `Desconto fixo (${fixo}) é maior que o desconto máximo (${max}).`,
        severity: 'warning',
      })
    }
  }
}
