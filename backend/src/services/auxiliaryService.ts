import type { AuxiliaryEntity } from '../schemas/product.schema.js'
import { AUXILIARY_ENTITIES, TEMPLATE_DELIMITER } from '../schemas/product.schema.js'
import { isBlank } from '../utils/productFormats.js'
import type { StoredCsvFile } from './csvFileService.js'
import { createRecordStream, normalizeRecord, resolveCsvOptions } from './csvService.js'

export type AuxiliaryCatalog = Map<string, string>

export type AuxiliaryCatalogs = Partial<Record<AuxiliaryEntity, AuxiliaryCatalog>>

/**
 * Campo do CSV → entidade do arquivo auxiliar.
 * `codigogrupo` é obrigatório no produto; o restante só se a coluna existir.
 */
export const FIELD_TO_AUXILIARY: Record<string, AuxiliaryEntity> = {
  codigogrupo: 'grupo',
  subgrupo: 'subgrupo',
  categoria: 'categoria',
  laboratorio: 'laboratorio',
  grupodepreco: 'grupodepreco',
  similar: 'similar',
  dcb: 'dcb',
}

const catalogCache = new Map<string, { catalog: AuxiliaryCatalog; issues: string[] }>()

export function invalidateAuxiliaryCatalogCache(fileId?: string): void {
  if (fileId) catalogCache.delete(fileId)
  else catalogCache.clear()
}

export async function loadAuxiliaryCatalog(
  file: StoredCsvFile
): Promise<{ catalog: AuxiliaryCatalog; issues: string[] }> {
  const cached = catalogCache.get(file.id)
  if (cached) return cached

  const options = await resolveCsvOptions(file.filePath, {
    delimiter: TEMPLATE_DELIMITER,
    hasHeader: true,
  })

  const catalog: AuxiliaryCatalog = new Map()
  const issues: string[] = []
  let row = 1

  const stream = createRecordStream(file.filePath, { ...options, hasHeader: true })

  for await (const raw of stream) {
    row++
    const record = normalizeRecord(raw as Record<string, string> | string[])
    const id = (record.id ?? record.codigo ?? '').trim()
    const nome = (record.nome ?? '').trim()

    if (isBlank(id)) {
      issues.push(`Linha ${row}: id vazio no arquivo auxiliar.`)
      continue
    }
    if (catalog.has(id)) {
      issues.push(`Linha ${row}: id ${id} duplicado no arquivo auxiliar.`)
      continue
    }
    catalog.set(id, nome)
  }

  const result = { catalog, issues }
  catalogCache.set(file.id, result)
  return result
}

export function emptyAuxiliaryCatalogs(): AuxiliaryCatalogs {
  const catalogs: AuxiliaryCatalogs = {}
  for (const entity of AUXILIARY_ENTITIES) {
    catalogs[entity] = undefined
  }
  return catalogs
}
