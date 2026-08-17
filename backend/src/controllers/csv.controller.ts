import type { FastifyReply, FastifyRequest } from 'fastify'
import type { MultipartFile } from '@fastify/multipart'
import { csvReanalyzeSchema } from '../schemas/csv.schema.js'
import type { CsvAnalyzeOptions } from '../schemas/csv.schema.js'
import { analyzeCsvFile } from '../services/csvService.js'
import { deleteStoredFile, getStoredFile, saveUploadedFile } from '../services/csvFileService.js'

export async function uploadCsvHandler(request: FastifyRequest, reply: FastifyReply) {
  let uploadedFile: MultipartFile | null = null
  const overrides: CsvAnalyzeOptions = {}

  for await (const part of request.parts()) {
    if (part.type === 'file') {
      uploadedFile = part
      continue
    }

    const value = String(part.value)
    if (part.fieldname === 'delimiter') overrides.delimiter = value
    if (part.fieldname === 'encoding') overrides.encoding = value
    if (part.fieldname === 'hasHeader') overrides.hasHeader = value === 'true'
  }

  if (!uploadedFile) {
    return reply.status(400).send({ success: false, message: 'Nenhum arquivo enviado.' })
  }

  const fileName = uploadedFile.filename
  if (!fileName.toLowerCase().endsWith('.csv')) {
    return reply.status(400).send({ success: false, message: 'Apenas arquivos .csv são aceitos.' })
  }

  try {
    const stored = await saveUploadedFile(fileName, uploadedFile.file)
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
    request.log.error({ err: error, fileName }, 'CSV upload failed')
    return reply.status(500).send({ success: false, message: 'Erro ao analisar o arquivo CSV.' })
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
