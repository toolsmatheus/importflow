import type { AuxiliaryEntity } from '../../schemas/product.schema.js'
import { isBlank, isValidIntegerId } from '../../utils/productFormats.js'
import {
  FIELD_TO_AUXILIARY,
  loadAuxiliaryCatalog,
  type AuxiliaryCatalogs,
} from '../auxiliar.service.js'
import { getStoredFile } from '../csv-arquivo.service.js'
import type { TmsDcbRecord } from '../tms.service.js'
import { clearControladoFields, isDcbResolvable } from './validacaoControlado.js'
import { empurrarIssue } from './contadores.js'
import { cell, hasColumn, type IssueCounters, type IssueValidacao } from './tipos.js'

export async function resolverCatalogosAuxiliares(
  auxiliary?: Partial<Record<AuxiliaryEntity, string>>
): Promise<{ catalogs: AuxiliaryCatalogs; loadIssues: IssueValidacao[] }> {
  const catalogs: AuxiliaryCatalogs = {}
  const loadIssues: IssueValidacao[] = []

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
        // id vazio / id duplicado no auxiliar bloqueiam o envio
        severity: 'error',
      })
    }
  }

  return { catalogs, loadIssues }
}

export function validarRefsAuxiliares(
  record: Record<string, string>,
  rowNumber: number,
  columns: Set<string>,
  catalogs: AuxiliaryCatalogs,
  issues: IssueValidacao[],
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
      empurrarIssue(issues, counters, {
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
        empurrarIssue(issues, counters, {
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
      empurrarIssue(issues, counters, {
        row: rowNumber,
        field,
        value,
        message: `${entity} "${value}" não encontrado no arquivo auxiliar.`,
        severity: 'error',
      })
    }
  }
}
