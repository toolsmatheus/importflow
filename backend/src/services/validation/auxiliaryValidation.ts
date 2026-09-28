import type { AuxiliaryEntity } from '../../schemas/product.schema.js'
import { isBlank, isValidIntegerId } from '../../utils/productFormats.js'
import {
  FIELD_TO_AUXILIARY,
  loadAuxiliaryCatalog,
  type AuxiliaryCatalogs,
} from '../auxiliaryService.js'
import { getStoredFile } from '../csvFileService.js'
import type { TmsDcbRecord } from '../tmsService.js'
import { clearControladoFields, isDcbResolvable } from './controladoValidation.js'
import { pushIssue } from './counters.js'
import { cell, hasColumn, type IssueCounters, type ValidationIssue } from './types.js'

export async function resolveAuxiliaryCatalogs(
  auxiliary?: Partial<Record<AuxiliaryEntity, string>>
): Promise<{ catalogs: AuxiliaryCatalogs; loadIssues: ValidationIssue[] }> {
  const catalogs: AuxiliaryCatalogs = {}
  const loadIssues: ValidationIssue[] = []

  if (!auxiliary) return { catalogs, loadIssues }

  for (const [entity, fileId] of Object.entries(auxiliary) as [AuxiliaryEntity, string][]) {
    const file = getStoredFile(fileId)
    if (!file) {
      loadIssues.push({
        row: 0,
        field: entity,
        value: '',
        message: `Arquivo auxiliar de ${entity} não encontrado. Envie novamente.`,
        severity: 'error',
      })
      continue
    }

    const { catalog, issues } = await loadAuxiliaryCatalog(file)
    catalogs[entity] = catalog

    for (const message of issues) {
      loadIssues.push({
        row: 0,
        field: entity,
        value: '',
        message,
        severity: 'warning',
      })
    }
  }

  return { catalogs, loadIssues }
}

export function validateAuxiliaryRefs(
  record: Record<string, string>,
  rowNumber: number,
  columns: Set<string>,
  catalogs: AuxiliaryCatalogs,
  issues: ValidationIssue[],
  counters: IssueCounters,
  tmsDcb: Map<string, TmsDcbRecord> | null = null
) {
  for (const [field, entity] of Object.entries(FIELD_TO_AUXILIARY)) {
    if (!hasColumn(columns, field) && field !== 'codigogrupo') continue

    // DCB: se ainda houver valor após resolveOrClearControlado, deve estar resolvido.
    if (field === 'dcb') {
      const value = cell(record, 'dcb').trim()
      if (isBlank(value)) continue
      if (isDcbResolvable(value, catalogs.dcb, tmsDcb)) continue
      clearControladoFields(record)
      pushIssue(issues, counters, {
        row: rowNumber,
        field,
        value,
        message: `dcb "${value}" não encontrado — controlado anulado (lista/DCB/MS limpos).`,
        severity: 'warning',
      })
      continue
    }

    const value = cell(record, field).trim()
    if (isBlank(value)) {
      if (field === 'codigogrupo') {
        // já coberto pelo obrigatório
      }
      continue
    }

    if (!isValidIntegerId(value)) continue

    const catalog = catalogs[entity]

    if (!catalog) {
      if (field === 'codigogrupo' || !isBlank(value)) {
        pushIssue(issues, counters, {
          row: rowNumber,
          field,
          value,
          message: `Arquivo auxiliar de ${entity} não enviado — não foi possível validar o id ${value}.`,
          severity: 'error',
        })
      }
      continue
    }

    if (!catalog.has(value)) {
      pushIssue(issues, counters, {
        row: rowNumber,
        field,
        value,
        message: `${entity} "${value}" não encontrado no arquivo auxiliar.`,
        severity: 'error',
      })
    }
  }
}
