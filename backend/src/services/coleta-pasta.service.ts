import { createReadStream, promises as fs } from 'fs'
import path from 'path'
import { z } from 'zod'
import { AUXILIARY_ENTITIES, type AuxiliaryEntity } from '../schemas/product.schema.js'
import type {
  CollectedAuxiliaryDto,
  FolderCollectResultDto,
} from '../dto/coleta-pasta.dto.js'
import type { OptionalFolderCollectResultDto } from '../dto/opcional.dto.js'
import {
  OPTIONAL_FILE_ALIASES,
  OPTIONAL_IMPORT_KINDS,
  OPTIONAL_IMPORT_READY_KINDS,
  type OptionalImportKind,
} from '../models/opcional.model.js'
import type { CsvAnalysisResult } from '../schemas/csv.schema.js'
import { loadAuxiliaryCatalog } from './auxiliar.service.js'
import { salvarArquivoEnviado } from './csv-arquivo.service.js'
import { analisarArquivoCsv } from './csv.service.js'

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

export type CollectedAuxiliary = CollectedAuxiliaryDto
export type FolderCollectResult = FolderCollectResultDto


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

export async function coletarDaPasta(folderPath: string): Promise<FolderCollectResult> {
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
    const stored = await salvarArquivoEnviado(productFileName, createReadStream(fullPath))
    products = await analisarArquivoCsv(stored, { delimiter: ';', hasHeader: true })
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
    const stored = await salvarArquivoEnviado(fileName, createReadStream(fullPath))
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

export type OptionalFolderCollectResult = OptionalFolderCollectResultDto

/** Coleta CSVs da Etapa 2 (fornecedor / validade / estoque / lotes) pela pasta. */
export async function coletarOpcionaisDaPasta(
  folderPath: string
): Promise<OptionalFolderCollectResult> {
  const resolved = path.resolve(folderPath)
  const stat = await fs.stat(resolved).catch(() => null)

  if (!stat || !stat.isDirectory()) {
    throw new Error(`Pasta não encontrada ou inválida: ${resolved}`)
  }

  const entries = await fs.readdir(resolved, { withFileTypes: true })
  const csvFiles = entries.filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.csv'))
  const filesByNorm = new Map(csvFiles.map((e) => [normalizeName(e.name), e.name]))

  const found: OptionalFolderCollectResult['found'] = []
  const missing: string[] = []
  const files: OptionalFolderCollectResult['files'] = []
  const claimed = new Set<string>()

  for (const kind of OPTIONAL_IMPORT_READY_KINDS) {
    const aliases = OPTIONAL_FILE_ALIASES[kind]
    const fileName = findByAliases(filesByNorm, aliases)

    if (!fileName) {
      missing.push(aliases[0])
      continue
    }

    const norm = normalizeName(fileName)
    if (claimed.has(norm)) continue
    claimed.add(norm)

    const fullPath = path.join(resolved, fileName)
    const content = await fs.readFile(fullPath, 'utf8')
    found.push({ kind, fileName })
    files.push({ kind, fileName, content })
  }

  return {
    folderPath: resolved,
    found,
    missing,
    files,
  }
}

export function expectedOptionalFolderFiles(): {
  kind: OptionalImportKind
  names: string[]
}[] {
  return OPTIONAL_IMPORT_KINDS.map((kind) => ({
    kind,
    names: OPTIONAL_FILE_ALIASES[kind],
  }))
}
