import { createReadStream, promises as fs } from 'fs'
import path from 'path'
import { z } from 'zod'
import { AUXILIARY_ENTITIES, type AuxiliaryEntity } from '../schemas/product.schema.js'
import { loadAuxiliaryCatalog } from './auxiliaryService.js'
import { saveUploadedFile } from './csvFileService.js'
import { analyzeCsvFile } from './csvService.js'
import type { CsvAnalysisResult } from '../schemas/csv.schema.js'

export const collectFolderBodySchema = z.object({
  folderPath: z.string().min(1),
})

/** Nomes aceitos (case-insensitive) para o CSV de produtos. */
export const PRODUCT_FILE_ALIASES = [
  'produtos.csv',
  'produto.csv',
  'modelo-produtos.csv',
  'products.csv',
] as const

/** Nomes aceitos por entidade auxiliar. */
export const AUXILIARY_FILE_ALIASES: Record<AuxiliaryEntity, string[]> = {
  grupo: ['grupo.csv'],
  subgrupo: ['subgrupo.csv'],
  categoria: ['categoria.csv'],
  laboratorio: ['laboratorio.csv', 'laboratório.csv'],
  grupodepreco: ['grupodepreco.csv', 'grupo-de-preco.csv', 'grupodepreço.csv'],
  similar: ['similar.csv', 'similaridade.csv'],
  dcb: ['dcb.csv'],
}

export interface CollectedAuxiliary {
  entity: AuxiliaryEntity
  fileId: string
  fileName: string
  fileSize: number
  recordCount: number
  parseWarnings: string[]
}

export interface FolderCollectResult {
  folderPath: string
  products: CsvAnalysisResult | null
  auxiliaries: Partial<Record<AuxiliaryEntity, CollectedAuxiliary>>
  found: { role: string; fileName: string }[]
  missing: string[]
  ignored: string[]
}

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function findByAliases(
  filesByNorm: Map<string, string>,
  aliases: readonly string[]
): string | undefined {
  for (const alias of aliases) {
    const hit = filesByNorm.get(normalizeName(alias))
    if (hit) return hit
  }
  return undefined
}

export async function collectFromFolder(folderPath: string): Promise<FolderCollectResult> {
  const resolved = path.resolve(folderPath)
  const stat = await fs.stat(resolved).catch(() => null)

  if (!stat || !stat.isDirectory()) {
    throw new Error(`Pasta não encontrada ou inválida: ${resolved}`)
  }

  const entries = await fs.readdir(resolved, { withFileTypes: true })
  const csvFiles = entries.filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.csv'))
  const filesByNorm = new Map(csvFiles.map((e) => [normalizeName(e.name), e.name]))

  const found: FolderCollectResult['found'] = []
  const missing: string[] = []
  const claimed = new Set<string>()

  const productFileName = findByAliases(filesByNorm, PRODUCT_FILE_ALIASES)
  let products: CsvAnalysisResult | null = null

  if (productFileName) {
    claimed.add(normalizeName(productFileName))
    const fullPath = path.join(resolved, productFileName)
    const stored = await saveUploadedFile(productFileName, createReadStream(fullPath))
    products = await analyzeCsvFile(stored, { delimiter: ';', hasHeader: true })
    found.push({ role: 'produtos', fileName: productFileName })
  } else {
    missing.push('produtos.csv')
  }

  const auxiliaries: FolderCollectResult['auxiliaries'] = {}

  for (const entity of AUXILIARY_ENTITIES) {
    const aliases = AUXILIARY_FILE_ALIASES[entity]
    const fileName = findByAliases(filesByNorm, aliases)

    if (!fileName) {
      if (entity === 'grupo') missing.push('grupo.csv')
      continue
    }

    claimed.add(normalizeName(fileName))
    const fullPath = path.join(resolved, fileName)
    const stored = await saveUploadedFile(fileName, createReadStream(fullPath))
    const { catalog, issues } = await loadAuxiliaryCatalog(stored)

    auxiliaries[entity] = {
      entity,
      fileId: stored.id,
      fileName: stored.fileName,
      fileSize: stored.fileSize,
      recordCount: catalog.size,
      parseWarnings: issues,
    }
    found.push({ role: entity, fileName })
  }

  const ignored = csvFiles
    .map((e) => e.name)
    .filter((name) => !claimed.has(normalizeName(name)))

  return {
    folderPath: resolved,
    products,
    auxiliaries,
    found,
    missing,
    ignored,
  }
}

export function expectedFolderFiles(): { role: string; names: string[] }[] {
  return [
    { role: 'produtos', names: [...PRODUCT_FILE_ALIASES] },
    ...AUXILIARY_ENTITIES.map((entity) => ({
      role: entity,
      names: AUXILIARY_FILE_ALIASES[entity],
    })),
  ]
}
