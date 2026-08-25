import type { FastifyReply, FastifyRequest } from 'fastify'
import { csvReanalyzeSchema } from '../schemas/csv.schema.js'
import type { CsvAnalyzeOptions, CsvAnalysisResult } from '../schemas/csv.schema.js'
import { analyzeCsvFile } from '../services/csvService.js'
import {
  deleteStoredFile,
  getStoredFile,
  saveUploadedFile,
  type StoredCsvFile,
} from '../services/csvFileService.js'

type NdjsonEvent =
  | { type: 'phase'; phase: 'saving' | 'analyze'; bytesTotal?: number }
  | {
      type: 'progress'
      phase: 'saving' | 'analyze'
      bytesWritten?: number
      bytesRead?: number
      bytesTotal?: number
      recordCount?: number
      percent?: number
    }
  | { type: 'done'; analysis: CsvAnalysisResult }
  | { type: 'error'; message: string }

function wantsNdjson(request: FastifyRequest): boolean {
  const accept = String(request.headers.accept ?? '')
  const query = request.query as { stream?: string }
  return accept.includes('application/x-ndjson') || query.stream === '1'
}

/**
 * Consome o multipart de imediato: o stream do arquivo DEVE ser lido dentro do
 * `for await`, senão o busboy trava e o handler nunca responde.
 */
async function consumeUpload(
  request: FastifyRequest,
  onSaveProgress?: (bytesWritten: number) => void
): Promise<{ stored: StoredCsvFile; overrides: CsvAnalyzeOptions; fileName: string }> {
  let stored: StoredCsvFile | null = null
  let fileName = ''
  const overrides: CsvAnalyzeOptions = {}

  for await (const part of request.parts()) {
    if (part.type === 'file') {
      if (stored) {
        part.file.resume()
        continue
      }

      fileName = part.filename
      if (!fileName.toLowerCase().endsWith('.csv')) {
        part.file.resume()
        throw Object.assign(new Error('Apenas arquivos .csv são aceitos.'), { statusCode: 400 })
      }

      stored = await saveUploadedFile(fileName, part.file, onSaveProgress)
      continue
    }

    const value = String(part.value).trim()
    if (!value) continue
    if (part.fieldname === 'delimiter') overrides.delimiter = value
    if (part.fieldname === 'encoding') overrides.encoding = value
    if (part.fieldname === 'hasHeader') overrides.hasHeader = value === 'true'
  }

  if (!stored) {
    throw Object.assign(new Error('Nenhum arquivo enviado.'), { statusCode: 400 })
  }

  return { stored, overrides, fileName }
}

export async function uploadCsvHandler(request: FastifyRequest, reply: FastifyReply) {
  if (!wantsNdjson(request)) {
    try {
      const { stored, overrides, fileName } = await consumeUpload(request)
      const analysis = await analyzeCsvFile(stored, overrides)
      request.log.info(
        {
          fileId: analysis.fileId,
          fileName: analysis.fileName,
          recordCount: analysis.recordCount,
          delimiter: analysis.delimiter,
          encoding: analysis.encoding,
        },
        'CSV analyzed'
      )
      return reply.send(analysis)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao analisar o arquivo CSV.'
      const statusCode =
        error && typeof error === 'object' && 'statusCode' in error
          ? Number((error as { statusCode: number }).statusCode)
          : 500
      if (statusCode >= 500) {
        request.log.error({ err: error }, 'CSV upload failed')
      }
      return reply.status(statusCode).send({
        success: false,
        message: statusCode >= 500 ? 'Erro ao analisar o arquivo CSV.' : message,
      })
    }
  }

  // Stream NDJSON: hijack para fazer flush linha a linha (PassThrough+Fastify bufferiza).
  reply.hijack()
  reply.raw.writeHead(200, {
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'X-Content-Type-Options': 'nosniff',
  })

  const writeEvent = (event: NdjsonEvent) => {
    reply.raw.write(`${JSON.stringify(event)}\n`)
  }

  try {
    writeEvent({ type: 'phase', phase: 'saving' })

    let lastSaveEmit = 0
    const { stored, overrides, fileName } = await consumeUpload(request, (bytesWritten) => {
      const now = Date.now()
      if (now - lastSaveEmit < 80) return
      lastSaveEmit = now
      writeEvent({ type: 'progress', phase: 'saving', bytesWritten })
    })

    writeEvent({ type: 'phase', phase: 'analyze', bytesTotal: stored.fileSize })

    const analysis = await analyzeCsvFile(stored, overrides, (progress) => {
      writeEvent({
        type: 'progress',
        phase: 'analyze',
        bytesRead: progress.bytesRead,
        bytesTotal: progress.bytesTotal,
        recordCount: progress.recordCount,
        percent: progress.percent,
      })
    })

    request.log.info(
      {
        fileId: analysis.fileId,
        fileName: analysis.fileName,
        recordCount: analysis.recordCount,
        delimiter: analysis.delimiter,
        encoding: analysis.encoding,
      },
      'CSV analyzed'
    )

    writeEvent({ type: 'done', analysis })
  } catch (error) {
    request.log.error({ err: error, fileName: 'upload' }, 'CSV upload failed')
    const message =
      error && typeof error === 'object' && 'statusCode' in error
        ? error instanceof Error
          ? error.message
          : 'Erro ao analisar o arquivo CSV.'
        : 'Erro ao analisar o arquivo CSV.'
    try {
      writeEvent({ type: 'error', message })
    } catch {
      // ignore write after close
    }
  } finally {
    reply.raw.end()
  }
}

export async function reanalyzeCsvHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = csvReanalyzeSchema.safeParse(request.body)

  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      message: 'Parâmetros inválidos.',
      errors: parsed.error.flatten().fieldErrors,
    })
  }

  const file = getStoredFile(parsed.data.fileId)
  if (!file) {
    return reply.status(404).send({ success: false, message: 'Arquivo não encontrado. Faça o upload novamente.' })
  }

  try {
    const analysis = await analyzeCsvFile(file, {
      delimiter: parsed.data.delimiter,
      encoding: parsed.data.encoding,
      hasHeader: parsed.data.hasHeader,
    })

    return reply.send(analysis)
  } catch (error) {
    request.log.error({ err: error, fileId: parsed.data.fileId }, 'CSV reanalyze failed')
    return reply.status(500).send({ success: false, message: 'Erro ao reanalisar o arquivo CSV.' })
  }
}

export async function deleteCsvHandler(request: FastifyRequest, reply: FastifyReply) {
  const { fileId } = request.params as { fileId: string }
  const removed = deleteStoredFile(fileId)

  if (removed) {
    request.log.info({ fileId }, 'CSV file discarded')
  }

  return reply.status(204).send()
}
