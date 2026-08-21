import type { FastifyReply, FastifyRequest } from 'fastify'
import type { MultipartFile } from '@fastify/multipart'
import { z } from 'zod'
import {
  AUXILIARY_ENTITIES,
  CONTROLADOS_HEADERS,
  FARMACIA_POPULAR_HEADERS,
  LISTA_PIS_COFINS,
  OPTIONAL_HEADERS,
  REQUIRED_HEADERS,
  buildAuxiliaryTemplateCsvContent,
  buildTemplateCsvContent,
  type AuxiliaryEntity,
} from '../schemas/product.schema.js'
import { loadAuxiliaryCatalog } from '../services/auxiliaryService.js'
import { getStoredFile, saveUploadedFile } from '../services/csvFileService.js'
import {
  validateBodySchema,
  validateProductCsv,
  validateProductRows,
  validateRowsBodySchema,
} from '../services/productValidationService.js'
import {
  fetchServerIdentification,
  getDefaultTmsBaseUrl,
  insertProducts,
} from '../services/tmsService.js'

export async function downloadProductTemplateHandler(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  const content = buildTemplateCsvContent()

  return reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', 'attachment; filename="modelo-produtos.csv"')
    .send(content)
}

export async function downloadAuxiliaryTemplateHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { entity } = request.params as { entity: string }

  if (!AUXILIARY_ENTITIES.includes(entity as AuxiliaryEntity)) {
    return reply.status(400).send({
      success: false,
      message: `Entidade auxiliar inválida. Use: ${AUXILIARY_ENTITIES.join(', ')}.`,
    })
  }

  const content = buildAuxiliaryTemplateCsvContent()

  return reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="modelo-${entity}.csv"`)
    .send(content)
}

export async function getProductFieldCatalogHandler(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  return reply.send({
    required: REQUIRED_HEADERS,
    optional: OPTIONAL_HEADERS,
    farmaciaPopular: FARMACIA_POPULAR_HEADERS,
    controlados: CONTROLADOS_HEADERS,
    listapiscofins: LISTA_PIS_COFINS,
    auxiliaryEntities: AUXILIARY_ENTITIES,
    delimiter: ';',
    markupFormula: 'venda = custo * (1 + markup/100)',
    tmsBaseUrl: getDefaultTmsBaseUrl(),
    rules: {
      controladoSemDcb: 'bloqueia',
      csosnECsticmsJuntos: 'alerta',
      markupInconsistente: 'alerta',
    },
  })
}

export async function uploadAuxiliaryHandler(request: FastifyRequest, reply: FastifyReply) {
  const { entity } = request.params as { entity: string }

  if (!AUXILIARY_ENTITIES.includes(entity as AuxiliaryEntity)) {
    return reply.status(400).send({
      success: false,
      message: `Entidade auxiliar inválida. Use: ${AUXILIARY_ENTITIES.join(', ')}.`,
    })
  }

  let uploadedFile: MultipartFile | null = null

  for await (const part of request.parts()) {
    if (part.type === 'file') {
      uploadedFile = part
      break
    }
  }

  if (!uploadedFile) {
    return reply.status(400).send({ success: false, message: 'Nenhum arquivo enviado.' })
  }

  if (!uploadedFile.filename.toLowerCase().endsWith('.csv')) {
    return reply.status(400).send({ success: false, message: 'Apenas arquivos .csv são aceitos.' })
  }

  try {
    const stored = await saveUploadedFile(uploadedFile.filename, uploadedFile.file)
    const { catalog, issues } = await loadAuxiliaryCatalog(stored)

    return reply.send({
      entity,
      fileId: stored.id,
      fileName: stored.fileName,
      fileSize: stored.fileSize,
      recordCount: catalog.size,
      parseWarnings: issues,
    })
  } catch (error) {
    request.log.error({ err: error, entity }, 'Auxiliary upload failed')
    return reply.status(500).send({ success: false, message: 'Erro ao processar o arquivo auxiliar.' })
  }
}

export async function validateProductHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = validateBodySchema.safeParse(request.body)

  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      message: 'Parâmetros de validação inválidos.',
      errors: parsed.error.flatten().fieldErrors,
    })
  }

  const file = getStoredFile(parsed.data.fileId)
  if (!file) {
    return reply
      .status(404)
      .send({ success: false, message: 'Arquivo não encontrado. Faça o upload novamente.' })
  }

  try {
    const result = await validateProductCsv(file, parsed.data)

    request.log.info(
      {
        fileId: result.fileId,
        totalRecords: result.totalRecords,
        errorCount: result.errorCount,
        warningCount: result.warningCount,
        canProceed: result.canProceed,
      },
      'Product CSV validated'
    )

    return reply.send(result)
  } catch (error) {
    request.log.error({ err: error, fileId: parsed.data.fileId }, 'Product CSV validation failed')
    return reply.status(500).send({ success: false, message: 'Erro ao validar o arquivo CSV.' })
  }
}

export async function validateProductRowsHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = validateRowsBodySchema.safeParse(request.body)

  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      message: 'Linhas inválidas para revalidação.',
      errors: parsed.error.flatten().fieldErrors,
    })
  }

  try {
    const result = await validateProductRows(parsed.data)
    return reply.send(result)
  } catch (error) {
    request.log.error({ err: error }, 'Product rows validation failed')
    return reply.status(500).send({ success: false, message: 'Erro ao revalidar as linhas.' })
  }
}

const sendBodySchema = z.object({
  rows: z.array(z.record(z.string())).min(1),
  tmsBaseUrl: z.string().url().optional(),
})

export async function identifyServerHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = request.query as { tmsBaseUrl?: string }

  try {
    const identification = await fetchServerIdentification(
      query.tmsBaseUrl ?? getDefaultTmsBaseUrl()
    )
    return reply.send({
      idFilial: identification.idFilial,
      tmsBaseUrl: query.tmsBaseUrl ?? getDefaultTmsBaseUrl(),
    })
  } catch (error) {
    request.log.error({ err: error }, 'TMS identification failed')
    return reply.status(502).send({
      success: false,
      message: error instanceof Error ? error.message : 'Falha ao consultar IdentificacaoServidor',
    })
  }
}

export async function sendProductsHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = sendBodySchema.safeParse(request.body)

  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      message: 'Payload de envio inválido.',
      errors: parsed.error.flatten().fieldErrors,
    })
  }

  try {
    const result = await insertProducts(
      parsed.data.rows,
      parsed.data.tmsBaseUrl ?? getDefaultTmsBaseUrl()
    )

    request.log.info(
      {
        idFilial: result.idFilial,
        total: result.total,
        successCount: result.successCount,
        errorCount: result.errorCount,
      },
      'TMS insert finished'
    )

    return reply.send(result)
  } catch (error) {
    request.log.error({ err: error }, 'TMS insert failed')
    return reply.status(502).send({
      success: false,
      message: error instanceof Error ? error.message : 'Falha ao enviar produtos ao TMS',
    })
  }
}
