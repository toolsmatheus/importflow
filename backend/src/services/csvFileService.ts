import { randomUUID } from 'crypto'
import { createWriteStream, promises as fs } from 'fs'
import path from 'path'
import { pipeline } from 'stream/promises'
import type { Readable } from 'stream'

export interface StoredCsvFile {
  id: string
  fileName: string
  filePath: string
  fileSize: number
  createdAt: Date
  lastAccessedAt: Date
}

const FILE_TTL_MS = 2 * 60 * 60 * 1000
const UPLOAD_DIR = path.join(process.cwd(), 'temp', 'uploads')

const files = new Map<string, StoredCsvFile>()

async function ensureUploadDir(): Promise<void> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true })
}

function cleanupExpiredFiles(): void {
  const now = Date.now()
  for (const [id, file] of files) {
    if (now - file.lastAccessedAt.getTime() > FILE_TTL_MS) {
      files.delete(id)
      fs.unlink(file.filePath).catch(() => undefined)
    }
  }
}

/**
 * O registro de arquivos vive apenas em memória, então qualquer arquivo presente
 * no disco na inicialização é órfão de uma execução anterior e não seria alcançado
 * pela expiração por TTL.
 */
export async function discardOrphanedFiles(): Promise<number> {
  try {
    const entries = await fs.readdir(UPLOAD_DIR)
    await Promise.all(
      entries.map((entry) => fs.unlink(path.join(UPLOAD_DIR, entry)).catch(() => undefined))
    )
    return entries.length
  } catch {
    return 0
  }
}

/**
 * Varredura periódica: sem ela, um arquivo enviado e abandonado só expiraria
 * quando outra requisição de upload acontecesse.
 */
export function startFileCleanupTimer(): void {
  const timer = setInterval(cleanupExpiredFiles, 15 * 60 * 1000)
  timer.unref()
}

export async function saveUploadedFile(
  fileName: string,
  stream: Readable
): Promise<StoredCsvFile> {
  cleanupExpiredFiles()
  await ensureUploadDir()

  const id = randomUUID()
  const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_')
  const filePath = path.join(UPLOAD_DIR, `${id}-${safeName}`)

  await pipeline(stream, createWriteStream(filePath))
  const stats = await fs.stat(filePath)
  const fileSize = stats.size

  const stored: StoredCsvFile = {
    id,
    fileName: path.basename(fileName),
    filePath,
    fileSize,
    createdAt: new Date(),
    lastAccessedAt: new Date(),
  }

  files.set(id, stored)
  return stored
}

export function getStoredFile(fileId: string): StoredCsvFile | undefined {
  const file = files.get(fileId)
  if (!file) return undefined

  if (Date.now() - file.lastAccessedAt.getTime() > FILE_TTL_MS) {
    files.delete(fileId)
    fs.unlink(file.filePath).catch(() => undefined)
    return undefined
  }

  file.lastAccessedAt = new Date()
  return file
}

export function deleteStoredFile(fileId: string): boolean {
  const file = files.get(fileId)
  if (!file) return false

  files.delete(fileId)
  fs.unlink(file.filePath).catch(() => undefined)
  return true
}
