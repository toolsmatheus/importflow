import type { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import {
  cancelarBarrasJob,
  obterBarrasJob,
  parseBarcodeExtraCsvText,
  iniciarBarrasJob,
} from '../services/opcional-barras.service.js'
import {
  cancelarLoteJob,
  obterLoteJob,
  parseLotCsvText,
  iniciarLoteJob,
} from '../services/opcional-lote.service.js'
import {
  cancelarEstoqueJob,
  obterEstoqueJob,
  parseStockCsvText,
  iniciarEstoqueJob,
} from '../services/opcional-estoque.service.js'
import {
  cancelarFornecedorJob,
  obterFornecedorJob,
  parseSupplierCsvText,
  iniciarFornecedorJob,
} from '../services/opcional-fornecedor.service.js'
import {
  cancelarValidadeJob,
  obterValidadeJob,
  parseValidityCsvText,
  iniciarValidadeJob,
} from '../services/opcional-validade.service.js'
import {
  coletarOpcionaisDaPasta,
  collectFolderBodySchema,
} from '../services/coleta-pasta.service.js'
import { getDefaultTmsBaseUrl } from '../services/tms.service.js'

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

export async function startBarcodeExtraSendHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  return startOptionalSend(request, reply, {
    parseRows: parseBarcodeExtraCsvText,
    startJob: iniciarBarrasJob,
    emptyMessage:
      'CSV sem registros. Esperado: codigo_migracao;codigobarra;codigoadicional;fator (busca por codigo_migracao, senão codigobarra; fator opcional → 1)',
    failMessage: 'Erro ao iniciar importação de códigos de barras adicionais',
    logLabel: 'Barcode extra send start failed',
  })
}

export async function getBarcodeExtraSendHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const jobId = (request.params as { jobId?: string }).jobId
  if (!jobId) {
    return reply.status(400).send({ success: false, message: 'jobId obrigatório' })
  }
  const snapshot = obterBarrasJob(jobId)
  if (!snapshot) {
    return reply.status(404).send({ success: false, message: 'Job não encontrado' })
  }
  return reply.send(snapshot)
}

export async function cancelBarcodeExtraSendHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const jobId = (request.params as { jobId?: string }).jobId
  if (!jobId) {
    return reply.status(400).send({ success: false, message: 'jobId obrigatório' })
  }
  const snapshot = cancelarBarrasJob(jobId)
  if (!snapshot) {
    return reply.status(404).send({ success: false, message: 'Job não encontrado' })
  }
  return reply.send(snapshot)
}

export async function barcodeExtraTemplateHandler(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  const csv =
    'codigo_migracao;codigobarra;codigoadicional;fator\n' +
    '1001;7891234567890;7891234567891;1\n' +
    ';7891234567890;7891234567892;2\n'
  reply.header('Content-Type', 'text/csv; charset=utf-8')
  reply.header(
    'Content-Disposition',
    'attachment; filename="CodigosAdicionais.csv"'
  )
  return reply.send(csv)
}

export async function startSupplierSendHandler(request: FastifyRequest, reply: FastifyReply) {
  return startOptionalSend(request, reply, {
    parseRows: parseSupplierCsvText,
    startJob: iniciarFornecedorJob,
    emptyMessage:
      'CSV sem registros. Esperado: codigo_migracao;codigobarra;codigoprodutofornecedor;codigofornecedor;fator (busca por codigo_migracao, senão codigobarra; codigofornecedor=codigo_migracao do favorecido; fator opcional → 1)',
    failMessage: 'Erro ao iniciar importação de códigos de fornecedor',
    logLabel: 'Supplier code send start failed',
  })
}

export async function getSupplierSendHandler(request: FastifyRequest, reply: FastifyReply) {
  const jobId = (request.params as { jobId?: string }).jobId
  if (!jobId) {
    return reply.status(400).send({ success: false, message: 'jobId obrigatório' })
  }
  const snapshot = obterFornecedorJob(jobId)
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
  const snapshot = cancelarFornecedorJob(jobId)
  if (!snapshot) {
    return reply.status(404).send({ success: false, message: 'Job não encontrado' })
  }
  return reply.send(snapshot)
}

export async function supplierTemplateHandler(_request: FastifyRequest, reply: FastifyReply) {
  const csv =
    'codigo_migracao;codigobarra;codigoprodutofornecedor;codigofornecedor;fator\n' +
    '1001;7891234567890;CAT-12345;88001;1\n' +
    ';7891234567890;CAT-67890;88002;2\n'
  reply.header('Content-Type', 'text/csv; charset=utf-8')
  reply.header(
    'Content-Disposition',
    'attachment; filename="CodigoFornecedor.csv"'
  )
  return reply.send(csv)
}

export async function startValiditySendHandler(request: FastifyRequest, reply: FastifyReply) {
  return startOptionalSend(request, reply, {
    parseRows: parseValidityCsvText,
    startJob: iniciarValidadeJob,
    emptyMessage:
      'CSV sem registros. Esperado: codigo;validade;quantidade (validade em dd/mm/yyyy; só produtos não controlados)',
    failMessage: 'Erro ao iniciar importação de validade',
    logLabel: 'Validity send start failed',
  })
}

export async function getValiditySendHandler(request: FastifyRequest, reply: FastifyReply) {
  const jobId = (request.params as { jobId?: string }).jobId
  if (!jobId) {
    return reply.status(400).send({ success: false, message: 'jobId obrigatório' })
  }
  const snapshot = obterValidadeJob(jobId)
  if (!snapshot) {
    return reply.status(404).send({ success: false, message: 'Job não encontrado' })
  }
  return reply.send(snapshot)
}

export async function cancelValiditySendHandler(request: FastifyRequest, reply: FastifyReply) {
  const jobId = (request.params as { jobId?: string }).jobId
  if (!jobId) {
    return reply.status(400).send({ success: false, message: 'jobId obrigatório' })
  }
  const snapshot = cancelarValidadeJob(jobId)
  if (!snapshot) {
    return reply.status(404).send({ success: false, message: 'Job não encontrado' })
  }
  return reply.send(snapshot)
}

export async function validityTemplateHandler(_request: FastifyRequest, reply: FastifyReply) {
  const csv =
    'codigo;validade;quantidade\n' +
    '1001;31/12/2027;24\n' +
    '1002;15/06/2028;12\n'
  reply.header('Content-Type', 'text/csv; charset=utf-8')
  reply.header(
    'Content-Disposition',
    'attachment; filename="modelo-validade-produtos.csv"'
  )
  return reply.send(csv)
}

export async function startStockSendHandler(request: FastifyRequest, reply: FastifyReply) {
  return startOptionalSend(request, reply, {
    parseRows: parseStockCsvText,
    startJob: iniciarEstoqueJob,
    emptyMessage:
      'CSV sem registros. Esperado: codigo;estoque (Produto.csv) ou codigobarras;estoque (layout barras). Só quantidade > 0 em produtos não controlados.',
    failMessage: 'Erro ao iniciar importação de estoque',
    logLabel: 'Stock send start failed',
  })
}

export async function getStockSendHandler(request: FastifyRequest, reply: FastifyReply) {
  const jobId = (request.params as { jobId?: string }).jobId
  if (!jobId) {
    return reply.status(400).send({ success: false, message: 'jobId obrigatório' })
  }
  const snapshot = obterEstoqueJob(jobId)
  if (!snapshot) {
    return reply.status(404).send({ success: false, message: 'Job não encontrado' })
  }
  return reply.send(snapshot)
}

export async function cancelStockSendHandler(request: FastifyRequest, reply: FastifyReply) {
  const jobId = (request.params as { jobId?: string }).jobId
  if (!jobId) {
    return reply.status(400).send({ success: false, message: 'jobId obrigatório' })
  }
  const snapshot = cancelarEstoqueJob(jobId)
  if (!snapshot) {
    return reply.status(404).send({ success: false, message: 'Job não encontrado' })
  }
  return reply.send(snapshot)
}

export async function stockTemplateHandler(_request: FastifyRequest, reply: FastifyReply) {
  const csv =
    'codigo;codigobarras;estoque\n' +
    '1001;7891234567890;24\n' +
    ';7891234567891;12\n'
  reply.header('Content-Type', 'text/csv; charset=utf-8')
  reply.header(
    'Content-Disposition',
    'attachment; filename="modelo-estoque.csv"'
  )
  return reply.send(csv)
}

export async function startLotSendHandler(request: FastifyRequest, reply: FastifyReply) {
  return startOptionalSend(request, reply, {
    parseRows: parseLotCsvText,
    startJob: iniciarLoteJob,
    emptyMessage:
      'CSV sem registros. Esperado: codigo;codigobarras;lote;registroms;estoque;fabricacao;validade (datas dd/mm/yyyy).',
    failMessage: 'Erro ao iniciar importação de lotes',
    logLabel: 'Lot send start failed',
  })
}

export async function getLotSendHandler(request: FastifyRequest, reply: FastifyReply) {
  const jobId = (request.params as { jobId?: string }).jobId
  if (!jobId) {
    return reply.status(400).send({ success: false, message: 'jobId obrigatório' })
  }
  const snapshot = obterLoteJob(jobId)
  if (!snapshot) {
    return reply.status(404).send({ success: false, message: 'Job não encontrado' })
  }
  return reply.send(snapshot)
}

export async function cancelLotSendHandler(request: FastifyRequest, reply: FastifyReply) {
  const jobId = (request.params as { jobId?: string }).jobId
  if (!jobId) {
    return reply.status(400).send({ success: false, message: 'jobId obrigatório' })
  }
  const snapshot = cancelarLoteJob(jobId)
  if (!snapshot) {
    return reply.status(404).send({ success: false, message: 'Job não encontrado' })
  }
  return reply.send(snapshot)
}

export async function lotTemplateHandler(_request: FastifyRequest, reply: FastifyReply) {
  const csv =
    'codigo;codigobarras;lote;registroms;estoque;fabricacao;validade\n' +
    '1001;7891234567890;A12;1234567890123;30;15/01/2024;30/06/2027\n' +
    ';7891234567891;B99;1234567890456;12;01/03/2024;31/12/2026\n'
  reply.header('Content-Type', 'text/csv; charset=utf-8')
  reply.header(
    'Content-Disposition',
    'attachment; filename="modelo-lotes-controlados.csv"'
  )
  return reply.send(csv)
}

export async function collectOptionalFolderHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const parsed = collectFolderBodySchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      message: 'Informe o caminho da pasta.',
      errors: parsed.error.flatten().fieldErrors,
    })
  }

  try {
    const result = await coletarOpcionaisDaPasta(parsed.data.folderPath)
    request.log.info(
      {
        folderPath: result.folderPath,
        found: result.found.length,
        missing: result.missing,
      },
      'Optional folder collected'
    )
    return reply.send(result)
  } catch (error) {
    request.log.error(
      { err: error, folderPath: parsed.data.folderPath },
      'Optional folder collect failed'
    )
    return reply.status(400).send({
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao ler a pasta',
    })
  }
}
