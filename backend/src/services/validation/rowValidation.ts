import { REQUIRED_HEADERS } from '../../schemas/product.schema.js'
import {
  isBlank,
  isValidIntegerId,
  isValidMigrationCode,
  isValidProductName,
  eanValidationFailureReason,
  parseBrazilianNumber,
  parseCodigoAdicionalList,
} from '../../utils/productFormats.js'
import type { AuxiliaryCatalogs } from '../auxiliaryService.js'
import type { TmsDcbRecord } from '../tmsService.js'
import { validateAuxiliaryRefs } from './auxiliaryValidation.js'
import {
  resolveOrClearControlado,
  validateControladoListaFields,
} from './controladoValidation.js'
import { pushIssue } from './counters.js'
import { validateFiscalAndPricing } from './fiscalValidation.js'
import {
  cell,
  DECIMAL_OPTIONAL_FIELDS,
  hasColumn,
  INTEGER_OPTIONAL_FIELDS,
  SN_FIELDS,
  type IssueCounters,
  type ValidationIssue,
} from './types.js'

export function validateRow(
  record: Record<string, string>,
  rowNumber: number,
  columns: Set<string>,
  catalogs: AuxiliaryCatalogs,
  issues: ValidationIssue[],
  counters: IssueCounters,
  tmsDcb: Map<string, TmsDcbRecord> | null = null,
  clientUf?: string
) {
  for (const field of REQUIRED_HEADERS) {
    if (!hasColumn(columns, field)) continue
    const value = cell(record, field)
    if (isBlank(value)) {
      pushIssue(issues, counters, {
        row: rowNumber,
        field,
        value: '',
        message: 'Campo obrigatório não informado.',
        severity: 'error',
      })
    }
  }

  const codigo = cell(record, 'codigo').trim()
  if (codigo && !isValidMigrationCode(codigo)) {
    pushIssue(issues, counters, {
      row: rowNumber,
      field: 'codigo',
      value: codigo,
      message: 'O código não pode conter letras — use apenas dígitos.',
      severity: 'error',
    })
  }

  const nome = cell(record, 'nome').trim()
  if (nome && !isValidProductName(nome)) {
    pushIssue(issues, counters, {
      row: rowNumber,
      field: 'nome',
      value: nome,
      message: 'O nome não pode ser vazio nem conter somente números.',
      severity: 'error',
    })
  }

  const grupo = cell(record, 'codigogrupo').trim()
  if (grupo && !isValidIntegerId(grupo)) {
    pushIssue(issues, counters, {
      row: rowNumber,
      field: 'codigogrupo',
      value: grupo,
      message: 'Deve ser um número inteiro (id do grupo no arquivo auxiliar).',
      severity: 'error',
    })
  }

  validateFiscalAndPricing(record, rowNumber, columns, issues, counters, clientUf)

  if (hasColumn(columns, 'codigobarras')) {
    const ean = cell(record, 'codigobarras').trim()
    if (!isBlank(ean)) {
      const reason = eanValidationFailureReason(ean)
      if (reason) {
        pushIssue(issues, counters, {
          row: rowNumber,
          field: 'codigobarras',
          value: ean,
          message: `Código de barras inválido (${reason}).`,
          severity: 'warning',
        })
      }
    }
  }

  if (hasColumn(columns, 'codigoadicional')) {
    const primary = cell(record, 'codigobarras').trim()
    const extras = parseCodigoAdicionalList(cell(record, 'codigoadicional'), primary)
    for (const extra of extras) {
      const reason = eanValidationFailureReason(extra)
      if (reason) {
        pushIssue(issues, counters, {
          row: rowNumber,
          field: 'codigoadicional',
          value: extra,
          message: `Código de barras adicional inválido (${reason}).`,
          severity: 'warning',
        })
      }
    }
  }

  for (const field of INTEGER_OPTIONAL_FIELDS) {
    if (!hasColumn(columns, field)) continue
    const value = cell(record, field).trim()
    if (isBlank(value)) continue
    if (!isValidIntegerId(value)) {
      pushIssue(issues, counters, {
        row: rowNumber,
        field,
        value,
        message: 'Deve ser um número inteiro (id no arquivo auxiliar).',
        severity: 'error',
      })
    }
  }

  for (const field of DECIMAL_OPTIONAL_FIELDS) {
    if (!hasColumn(columns, field)) continue
    const value = cell(record, field)
    if (isBlank(value)) continue
    if (parseBrazilianNumber(value) === null) {
      pushIssue(issues, counters, {
        row: rowNumber,
        field,
        value,
        message: 'Valor numérico inválido.',
        severity: 'error',
      })
    }
  }

  for (const field of SN_FIELDS) {
    if (!hasColumn(columns, field)) continue
    const value = cell(record, field).trim().toUpperCase()
    if (isBlank(value)) continue
    if (value !== 'S' && value !== 'N') {
      pushIssue(issues, counters, {
        row: rowNumber,
        field,
        value: cell(record, field),
        message: 'Valor deve ser S ou N.',
        severity: 'error',
      })
    }
  }

  if (hasColumn(columns, 'ativo')) {
    const ativo = cell(record, 'ativo').trim().toUpperCase()
    if (!isBlank(ativo) && ativo !== 'A' && ativo !== 'I') {
      pushIssue(issues, counters, {
        row: rowNumber,
        field: 'ativo',
        value: cell(record, 'ativo'),
        message: 'Valor deve ser A (ativo) ou I (inativo).',
        severity: 'error',
      })
    }
  }

  if (hasColumn(columns, 'tipopreco')) {
    const tipopreco = cell(record, 'tipopreco').trim().toUpperCase().replace(/\s+/g, '')
    if (!isBlank(tipopreco)) {
      const ok =
        tipopreco === 'L' ||
        tipopreco === 'LIBERADO' ||
        tipopreco === 'TPLIBERADO' ||
        tipopreco === 'TP_LIBERADO' ||
        tipopreco === 'M' ||
        tipopreco === 'MONITORADO' ||
        tipopreco === 'TPMONITORADO' ||
        tipopreco === 'TP_MONITORADO'
      if (!ok) {
        pushIssue(issues, counters, {
          row: rowNumber,
          field: 'tipopreco',
          value: cell(record, 'tipopreco'),
          message: 'Valor inválido. Opções: LIBERADO/L ou MONITORADO/M (vazio = LIBERADO).',
          severity: 'error',
        })
      }
    }
  }

  if (hasColumn(columns, 'medfciapop') && cell(record, 'medfciapop').trim().toUpperCase() === 'S') {
    for (const field of ['qtdfciapop', 'valorfciapop'] as const) {
      if (isBlank(cell(record, field))) {
        pushIssue(issues, counters, {
          row: rowNumber,
          field,
          value: '',
          message: 'Obrigatório quando medfciapop = S.',
          severity: 'error',
        })
      }
    }
  }

  // DCB irresolvível ou lista sem DCB válido → anula controlado (aviso), não bloqueia.
  const controladoCleared = resolveOrClearControlado(
    record,
    rowNumber,
    columns,
    catalogs,
    issues,
    counters,
    tmsDcb
  )

  validateControladoListaFields(
    record,
    rowNumber,
    columns,
    issues,
    counters,
    controladoCleared
  )

  validateAuxiliaryRefs(record, rowNumber, columns, catalogs, issues, counters, tmsDcb)
}
