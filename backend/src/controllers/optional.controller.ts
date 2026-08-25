import type { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import {
  cancelBarcodeJob,
  getBarcodeJob,
  parseBarcodeCsvText,
  startBarcodeJob,
} from '../services/optionalBarcodeJobService.js'
import {
  cancelSupplierJob,
  getSupplierJob,
  parseSupplierCsvText,
  startSupplierJob,
} from '../services/optionalSupplierJobService.js'
import { getDefaultTmsBaseUrl } from '../services/tmsService.js'

const startBodySchema = z.object({
  rows: z.array(z.record(z.string())).min(1).max(100000).optional(),
  tmsBaseUrl: z.string().url().optional(),
  mode: z.enum(['live', 'simulate']).optional(),
})

async function readMultipartCsv(
  request: FastifyRequest,
  parseRows: (text: string) => Record<string, string>[]
): Promise<{
  rows?: Record<string, string>[]
  tmsBaseUrl?: string
  mode?: 'live' | 'simulate'
}> {
  let fileText = ''
  let tmsBaseUrl: string | undefined
  let mode: 'live' | 'simulate' | undefined

  for await (const part of request.parts()) {
    if (part.type === 'file') {
      const chunks: Buffer[] = []
      for await (const chunk of part.file) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      }
      fileText = Buffer.concat(chunks).toString('utf8')
    } else if (part.type === 'field') {
      if (part.fieldname === 'tmsBaseUrl') tmsBaseUrl = String(part.value)
      if (part.fieldname === 'mode') {
        const v = String(part.value)
        if (v === 'live' || v === 'simulate') mode = v
      }
    }
  }

  const rows = fileText ? parseRows(fileText) : undefined
  return { rows, tmsBaseUrl, mode }
}

async function startOptionalSend(
  request: FastifyRequest,
  reply: FastifyReply,
  options: {
    parseRows: (text: string) => Record<string, string>[]
    startJob: (input: {
      rows: Record<string, string>[]
      tmsBaseUrl?: string
      mode?: 'live' | 'simulate'
    }) => Promise<unknown>
    emptyMessage: string
    failMessage: string
    logLabel: string
  }
) {
  try {
    const contentType = String(request.headers['content-type'] ?? '')
    let rows: Record<string, string>[] | undefined
    let tmsBaseUrl: string | undefined
    let mode: 'live' | 'simulate' | undefined

    if (contentType.includes('multipart/form-data')) {
      const parsed = await readMultipartCsv(request, options.parseRows)
      rows = parsed.rows
      tmsBaseUrl = parsed.tmsBaseUrl
      mode = parsed.mode
    } else {
      const body = startBodySchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send({
          success: false,
          message: 'Envie rows[] ou um arquivo CSV multipart.',
          errors: body.error.flatten().fieldErrors,
        })
      }
      rows = body.data.rows
      tmsBaseUrl = body.data.tmsBaseUrl
      mode = body.data.mode
    }

    if (!rows?.length) {
      return reply.status(400).send({
        success: false,
        message: options.emptyMessage,
      })
    }

    const snapshot = await options.startJob({
      rows,
      tmsBaseUrl: tmsBaseUrl || getDefaultTmsBaseUrl(),
      mode,
    })
    return reply.status(202).send(snapshot)
  } catch (error) {
    request.log.error({ err: error }, options.logLabel)
    return reply.status(500).send({
      success: false,
      message: error instanceof Error ? error.message : options.failMessage,
    })
  }
}

export async function startBarcodeSendHandler(request: FastifyRequest, reply: FastifyReply) {
  return startOptionalSend(request, reply, {
    parseRows: parseBarcodeCsvText,
    startJob: startBarcodeJob,
    emptyMessage:
      'CSV sem registros. Esperado: codigo;codigobarras;codigoadicional;fator (codigo opcional)',
    failMessage: 'Erro ao iniciar importação de códigos de barras',
    logLabel: 'Barcode send start failed',
  })
}

export async function getBarcodeSendHandler(request: FastifyRequest, reply: FastifyReply) {
  const jobId = (request.params as { jobId?: string }).jobId
  if (!jobId) {
    return reply.status(400).send({ success: false, message: 'jobId obrigatório' })
  }
  const snapshot = getBarcodeJob(jobId)
  if (!snapshot) {
    return reply.status(404).send({ success: false, message: 'Job não encontrado' })
  }
  return reply.send(snapshot)
}

export async function cancelBarcodeSendHandler(request: FastifyRequest, reply: FastifyReply) {
  const jobId = (request.params as { jobId?: string }).jobId
  if (!jobId) {
    return reply.status(400).send({ success: false, message: 'jobId obrigatório' })
  }
  const snapshot = cancelBarcodeJob(jobId)
  if (!snapshot) {
    return reply.status(404).send({ success: false, message: 'Job não encontrado' })
  }
  return reply.send(snapshot)
}

export async function barcodeTemplateHandler(_request: FastifyRequest, reply: FastifyReply) {
  const csv =
    'codigo;codigobarras;codigoadicional;fator\n' +
    '1001;7891234567890;7891234567891;1\n' +
    ';7891234567890;7891234567892;2\n'
  reply.header('Content-Type', 'text/csv; charset=utf-8')
  reply.header(
    'Content-Disposition',
    'attachment; filename="modelo-codigos-barras-adicionais.csv"'
  )
  return reply.send(csv)
}

export async function startSupplierSendHandler(request: FastifyRequest, reply: FastifyReply) {
  return startOptionalSend(request, reply, {
    parseRows: parseSupplierCsvText,
    startJob: startSupplierJob,
    emptyMessage:
      'CSV sem registros. Esperado: codigo;codigobarras;codigofornecedor;codigooriginal;fator (codigo do produto opcional; codigofornecedor=codigo_migracao do fornecedor; codigooriginal=código do produto no fornecedor)',
    failMessage: 'Erro ao iniciar importação de códigos de fornecedor',
    logLabel: 'Supplier code send start failed',
  })
}

export async function getSupplierSendHandler(request: FastifyRequest, reply: FastifyReply) {
  const jobId = (request.params as { jobId?: string }).jobId
  if (!jobId) {
    return reply.status(400).send({ success: false, message: 'jobId obrigatório' })
  }
  const snapshot = getSupplierJob(jobId)
  if (!snapshot) {
    return reply.status(404).send({ success: false, message: 'Job não encontrado' })
  }
  return reply.send(snapshot)
}

export async function cancelSupplierSendHandler(request: FastifyRequest, reply: FastifyReply) {
  const jobId = (request.params as { jobId?: string }).jobId
  if (!jobId) {
    return reply.status(400).send({ success: false, message: 'jobId obrigatório' })
  }
  const snapshot = cancelSupplierJob(jobId)
  if (!snapshot) {
    return reply.status(404).send({ success: false, message: 'Job não encontrado' })
  }
  return reply.send(snapshot)
}

export async function supplierTemplateHandler(_request: FastifyRequest, reply: FastifyReply) {
  const csv =
    'codigo;codigobarras;codigofornecedor;codigooriginal;fator\n' +
    '1001;7891234567890;88001;CAT-12345;1\n' +
    ';7891234567890;88002;CAT-67890;2\n'
  reply.header('Content-Type', 'text/csv; charset=utf-8')
  reply.header(
    'Content-Disposition',
    'attachment; filename="modelo-codigos-fornecedor.csv"'
  )
  return reply.send(csv)
}
