import { createReadStream, promises as fs } from 'fs'
import { parse } from 'csv-parse'
import type { CsvAnalysisResult, CsvAnalyzeOptions } from '../schemas/csv.schema.js'
import {
  SAMPLE_SIZE,
  decodeBuffer,
  detectDelimiter,
  detectEncoding,
  detectHasHeader,
  parseSampleLine,
} from '../utils/csvDetection.js'
import type { StoredCsvFile } from './csvFileService.js'

export interface ResolvedOptions {
  delimiter: string
  encoding: string
  hasHeader: boolean
}

async function readSample(filePath: string): Promise<Buffer> {
  const handle = await fs.open(filePath, 'r')
  try {
    const buffer = Buffer.alloc(SAMPLE_SIZE)
    const { bytesRead } = await handle.read(buffer, 0, SAMPLE_SIZE, 0)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}

async function autoDetectOptions(filePath: string): Promise<ResolvedOptions> {
  const sampleBuffer = await readSample(filePath)
  const encoding = detectEncoding(sampleBuffer)
  const sampleText = decodeBuffer(sampleBuffer, encoding)
  const delimiter = detectDelimiter(sampleText)

  const lines = sampleText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const firstRow = lines[0] ? parseSampleLine(lines[0], delimiter) : []
  const secondRow = lines[1] ? parseSampleLine(lines[1], delimiter) : null
  const hasHeader = detectHasHeader(firstRow, secondRow)

  return { delimiter, encoding, hasHeader }
}

function resolveOptions(
  auto: ResolvedOptions,
  overrides?: CsvAnalyzeOptions
): ResolvedOptions {
  return {
    delimiter: overrides?.delimiter ?? auto.delimiter,
    encoding: overrides?.encoding ?? auto.encoding,
    hasHeader: overrides?.hasHeader ?? auto.hasHeader,
  }
}

function getStreamEncoding(encoding: string): BufferEncoding {
  const normalized = encoding.toUpperCase()
  return normalized === 'UTF-8' ? 'utf8' : 'latin1'
}

export async function resolveCsvOptions(
  filePath: string,
  overrides?: CsvAnalyzeOptions
): Promise<ResolvedOptions> {
  const auto = await autoDetectOptions(filePath)
  return resolveOptions(auto, overrides)
}

/**
 * Cria um stream de registros do CSV, sem carregar o arquivo em memória.
 * Usado pela validação e pela importação.
 */
export function createRecordStream(filePath: string, options: ResolvedOptions) {
  const parser = parse({
    delimiter: options.delimiter,
    columns: options.hasHeader,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  })

  const stream = createReadStream(filePath, { encoding: getStreamEncoding(options.encoding) })
  stream.on('error', (error) => parser.destroy(error))

  return stream.pipe(parser)
}

/** Arquivos sem cabeçalho chegam como array; converte para as chaves `coluna_N`. */
export function normalizeRecord(raw: Record<string, string> | string[]): Record<string, string> {
  if (!Array.isArray(raw)) return raw

  const record: Record<string, string> = {}
  raw.forEach((value, index) => {
    record[`coluna_${index + 1}`] = value
  })
  return record
}

async function streamAnalyze(
  file: StoredCsvFile,
  options: ResolvedOptions
): Promise<Omit<CsvAnalysisResult, 'fileId' | 'fileName' | 'fileSize'>> {
  const streamEncoding = getStreamEncoding(options.encoding)

  return new Promise((resolve, reject) => {
    let recordCount = 0
    let columns: string[] = []
    let columnCount = 0
    let headersCaptured = false

    const parser = parse({
      delimiter: options.delimiter,
      columns: options.hasHeader ? true : false,
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    })

    const stream = createReadStream(file.filePath, { encoding: streamEncoding })

    parser.on('readable', () => {
      let record: Record<string, string> | string[] | null
      while ((record = parser.read()) !== null) {
        recordCount++

        if (options.hasHeader) {
          if (!headersCaptured && typeof record === 'object' && !Array.isArray(record)) {
            columns = Object.keys(record)
            columnCount = columns.length
            headersCaptured = true
          }
        } else if (Array.isArray(record)) {
          columnCount = Math.max(columnCount, record.length)
          if (columns.length === 0) {
            columns = record.map((_, index) => `coluna_${index + 1}`)
          }
        }
      }
    })

    parser.on('error', reject)

    parser.on('end', () => {
      resolve({
        recordCount,
        columnCount: columnCount || columns.length,
        encoding: options.encoding,
        delimiter: options.delimiter,
        hasHeader: options.hasHeader,
        columns,
      })
    })

    stream.on('error', reject)
    stream.pipe(parser)
  })
}

export async function analyzeCsvFile(
  file: StoredCsvFile,
  overrides?: CsvAnalyzeOptions
): Promise<CsvAnalysisResult> {
  const auto = await autoDetectOptions(file.filePath)
  const options = resolveOptions(auto, overrides)
  let analysis = await streamAnalyze(file, options)

  if (analysis.columns.length === 0 && options.hasHeader) {
    const sampleBuffer = await readSample(file.filePath)
    const sampleText = decodeBuffer(sampleBuffer, options.encoding)
    const firstLine = sampleText.split(/\r?\n/).find((line) => line.trim())
    if (firstLine) {
      const columns = parseSampleLine(firstLine, options.delimiter)
      analysis = {
        ...analysis,
        columns,
        columnCount: columns.length,
      }
    }
  }

  return {
    fileId: file.id,
    fileName: file.fileName,
    fileSize: file.fileSize,
    ...analysis,
  }
}
