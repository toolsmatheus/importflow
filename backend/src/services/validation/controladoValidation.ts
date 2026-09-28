import { isBlank, isValidIntegerId } from '../../utils/productFormats.js'
import { padDcbCode, lookupAnvisaDcb } from '../dcbIndexService.js'
import type { AuxiliaryCatalogs } from '../auxiliaryService.js'
import { fetchTmsDcbCatalog, type TmsDcbRecord } from '../tmsService.js'
import {
  isValidListaControladoCsv,
  TMS_LISTA_CONTROLADO_HINT,
} from '../listaControlado.js'
import { pushIssue } from './counters.js'
import { cell, hasColumn, type IssueCounters, type ValidationIssue } from './types.js'

/** DCB no banco (tabela DCB do TMS). */
export function dcbExistsInTms(
  value: string,
  tmsDcb: Map<string, TmsDcbRecord> | null
): boolean {
  if (!tmsDcb || tmsDcb.size === 0) return false
  const padded = padDcbCode(value)
  if (tmsDcb.has(padded) || tmsDcb.has(value)) return true
  const asNumber = String(Number(value))
  return asNumber !== 'NaN' && tmsDcb.has(asNumber)
}

/** Código Anvisa da base validada (CMED / controlados). */
export function dcbExistsInAnvisaIndex(value: string): boolean {
  return lookupAnvisaDcb(value) !== null
}

/** DCB no auxiliar, tabela TMS ou índice Anvisa. */
export function isDcbResolvable(
  value: string,
  catalog: AuxiliaryCatalogs['dcb'] | undefined,
  tmsDcb: Map<string, TmsDcbRecord> | null
): boolean {
  const raw = value.trim()
  if (!raw) return false
  if (catalog?.has(raw) || catalog?.has(String(Number(raw)))) return true
  if (dcbExistsInTms(raw, tmsDcb)) return true
  if (dcbExistsInAnvisaIndex(raw)) return true
  return false
}

const CONTROLADO_CLEAR_FIELDS = [
  'listacontrole',
  'dcb',
  'registroms',
  'unidadesngpc',
  'unidemb',
  'unidadesporembalagem',
] as const

/** Remove marcação de controlado da linha (DCB irresolvível). */
export function clearControladoFields(record: Record<string, string>): string[] {
  const cleared: string[] = []
  for (const field of CONTROLADO_CLEAR_FIELDS) {
    if (!(field in record)) continue
    if (isBlank(record[field])) continue
    record[field] = ''
    cleared.push(field)
  }
  return cleared
}

/**
 * Se há DCB/lista de controle mas o DCB não resolve → anula controlado (aviso).
 * Retorna true se o controlado foi anulado.
 */
export function resolveOrClearControlado(
  record: Record<string, string>,
  rowNumber: number,
  columns: Set<string>,
  catalogs: AuxiliaryCatalogs,
  issues: ValidationIssue[],
  counters: IssueCounters,
  tmsDcb: Map<string, TmsDcbRecord> | null
): boolean {
  const hasListaCol = hasColumn(columns, 'listacontrole')
  const hasDcbCol = hasColumn(columns, 'dcb')
  if (!hasListaCol && !hasDcbCol) return false

  const lista = hasListaCol ? cell(record, 'listacontrole').trim() : ''
  const dcb = hasDcbCol ? cell(record, 'dcb').trim() : ''

  if (isBlank(lista) && isBlank(dcb)) return false

  const dcbOk =
    !isBlank(dcb) && isValidIntegerId(dcb) && isDcbResolvable(dcb, catalogs.dcb, tmsDcb)

  if (dcbOk) return false

  const previousDcb = dcb
  clearControladoFields(record)

  const reason = isBlank(previousDcb)
    ? 'DCB vazio'
    : !isValidIntegerId(previousDcb)
      ? `DCB "${previousDcb}" inválido`
      : `DCB "${previousDcb}" não encontrado no auxiliar, na tabela DCB do banco nem na base Anvisa`

  pushIssue(issues, counters, {
    row: rowNumber,
    field: 'dcb',
    value: previousDcb,
    message: `${reason} — controlado anulado (lista/DCB/MS limpos). Produto segue como não controlado.`,
    severity: 'warning',
  })

  return true
}

export async function loadTmsDcbForValidation(): Promise<Map<string, TmsDcbRecord> | null> {
  try {
    return await fetchTmsDcbCatalog()
  } catch {
    return null
  }
}

/** Valida listacontrole / registroms após tentativa de anulação por DCB. */
export function validateControladoListaFields(
  record: Record<string, string>,
  rowNumber: number,
  columns: Set<string>,
  issues: ValidationIssue[],
  counters: IssueCounters,
  controladoCleared: boolean
) {
  if (controladoCleared || !hasColumn(columns, 'listacontrole')) return

  const listaControle = cell(record, 'listacontrole').trim()
  if (isBlank(listaControle)) return

  if (!isValidListaControladoCsv(listaControle)) {
    pushIssue(issues, counters, {
      row: rowNumber,
      field: 'listacontrole',
      value: listaControle,
      message: `Lista de controle inválida no TMS. Use: ${TMS_LISTA_CONTROLADO_HINT} ou T (antimicrobiano).`,
      severity: 'error',
    })
  }
  const dcb = cell(record, 'dcb').trim()
  const registroms = hasColumn(columns, 'registroms')
    ? cell(record, 'registroms').trim()
    : ''
  if (isBlank(registroms) && !isBlank(dcb) && isValidIntegerId(dcb)) {
    pushIssue(issues, counters, {
      row: rowNumber,
      field: 'registroms',
      value: '',
      message:
        'Registro MS é obrigatório quando o produto é controlado (listacontrole preenchida).',
      severity: 'error',
    })
  }
}
