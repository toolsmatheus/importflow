import type { FastifyReply, FastifyRequest } from 'fastify'
import type { MultipartFile } from '@fastify/multipart'
import { z } from 'zod'
import {
  AUXILIARY_ENTITIES,
  CONTROLADOS_HEADERS,
  FARMACIA_POPULAR_HEADERS,
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
} from '../services/tmsService.js'
import {
  cancelSendJob,
  createSendJob,
  getSendJob,
  buildSkippedProductsCsv,
  pauseSendJob,
  resumeSendJob,
  retryFailedSendJob,
} from '../services/sendJobService.js'
import {
  collectFolderBodySchema,
  collectFromFolder,
  expectedFolderFiles,
} from '../services/folderCollectService.js'
import { suggestControlados } from '../services/controladoSuggestService.js'

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
    auxiliaryEntities: AUXILIARY_ENTITIES,
    delimiter: ';',
    markupFormula: 'venda = custo * (1 + markup/100)',
    tmsBaseUrl: getDefaultTmsBaseUrl(),
    rules: {
      controladoSemDcb: 'bloqueia',
      controladoSemRegistroMs: 'bloqueia',
      markupInconsistente: 'alerta',
      aliquotaZeroStIsento: 'bloqueia (exatamente uma de st/isento = S)',
      aliquotaPercent: 'se não existir em AliquotaICMS, cria tipICMS/alSAIDA',
      unidadeEstoque: 'sempre UN no TMS (coluna unidade do CSV ignorada)',
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

const startSendBodySchema = z.object({
  rows: z.array(z.record(z.string())).min(1).max(50000),
  tmsBaseUrl: z.string().url().optional(),
  mode: z.enum(['live', 'simulate']).optional(),
  batchSize: z.number().int().min(10).max(500).optional(),
  concurrency: z.number().int().min(1).max(8).optional(),
  auxiliary: z
    .object({
      grupo: z.string().uuid().optional(),
      subgrupo: z.string().uuid().optional(),
      categoria: z.string().uuid().optional(),
      laboratorio: z.string().uuid().optional(),
      grupodepreco: z.string().uuid().optional(),
      similar: z.string().uuid().optional(),
      dcb: z.string().uuid().optional(),
    })
    .optional(),
})

const suggestControladosBodySchema = z.object({
  rows: z.array(z.record(z.string())).min(1).max(50000),
  auxiliary: z
    .object({
      dcb: z.string().uuid().optional(),
    })
    .optional(),
})

export async function suggestControladosHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = suggestControladosBodySchema.safeParse(request.body)

  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      message: 'Envie as linhas do produtos.csv para gerar sugestões.',
      errors: parsed.error.flatten().fieldErrors,
    })
  }

  try {
    let dcbCatalog = undefined
    const dcbFileId = parsed.data.auxiliary?.dcb
    if (dcbFileId) {
      const file = getStoredFile(dcbFileId)
      if (file) {
        const loaded = await loadAuxiliaryCatalog(file)
        dcbCatalog = loaded.catalog
      }
    }

    const result = suggestControlados(parsed.data.rows, dcbCatalog)
    return reply.send(result)
  } catch (error) {
    request.log.error({ err: error }, 'Controlado suggest failed')
    return reply.status(500).send({
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao sugerir controlados',
    })
  }
}

export async function getFolderExpectHandler(_request: FastifyRequest, reply: FastifyReply) {
  return reply.send({
    expected: expectedFolderFiles(),
    tip: 'Coloque na pasta arquivos como produtos.csv, grupo.csv, categoria.csv, etc.',
  })
}

export async function collectFolderHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = collectFolderBodySchema.safeParse(request.body)

  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      message: 'Informe o caminho da pasta.',
      errors: parsed.error.flatten().fieldErrors,
    })
  }

  try {
    const result = await collectFromFolder(parsed.data.folderPath)

    request.log.info(
      {
        folderPath: result.folderPath,
        found: result.found.length,
        missing: result.missing,
        hasProducts: Boolean(result.products),
      },
      'Folder collected'
    )

    return reply.send(result)
  } catch (error) {
    request.log.error({ err: error, folderPath: parsed.data.folderPath }, 'Folder collect failed')
    return reply.status(400).send({
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao ler a pasta',
    })
  }
}

export async function identifyServerHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = request.query as { tmsBaseUrl?: string }

  try {
    const identification = await fetchServerIdentification(
      query.tmsBaseUrl ?? getDefaultTmsBaseUrl()
    )
    return reply.send({
      idFilial: identification.idFilial,
      versao: identification.versao,
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

export async function startSendJobHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = startSendBodySchema.safeParse(request.body)

  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      message: 'Payload de envio inválido.',
      errors: parsed.error.flatten().fieldErrors,
    })
  }

  try {
    const auxiliaries: { entity: AuxiliaryEntity; codigo: string; descricao: string }[] = []
    const auxIds = parsed.data.auxiliary ?? {}

    for (const entity of AUXILIARY_ENTITIES) {
      const fileId = auxIds[entity]
      if (!fileId) continue
      const file = getStoredFile(fileId)
      if (!file) {
        return reply.status(400).send({
          success: false,
          message: `Arquivo auxiliar ${entity}.csv expirado. Envie novamente na etapa de auxiliares.`,
        })
      }
      const loaded = await loadAuxiliaryCatalog(file)
      for (const [codigo, descricao] of loaded.catalog.entries()) {
        auxiliaries.push({ entity, codigo, descricao })
      }
    }

    const snapshot = await createSendJob({
      rows: parsed.data.rows,
      mode: parsed.data.mode ?? 'simulate',
      tmsBaseUrl: parsed.data.tmsBaseUrl,
      batchSize: parsed.data.batchSize,
      concurrency: parsed.data.concurrency,
      auxiliaries,
    })

    request.log.info(
      {
        jobId: snapshot.id,
        mode: snapshot.mode,
        total: snapshot.total,
        grupos: snapshot.gruposTotal,
        auxiliares: snapshot.auxTotal,
        entidades: Object.fromEntries(
          AUXILIARY_ENTITIES.map((entity) => [
            entity,
            auxiliaries.filter((item) => item.entity === entity).length,
          ])
        ),
        batchSize: snapshot.batchSize,
        concurrency: snapshot.concurrency,
      },
      'Send job started'
    )

    return reply.status(202).send(snapshot)
  } catch (error) {
    request.log.error({ err: error }, 'Send job start failed')
    return reply.status(502).send({
      success: false,
      message: error instanceof Error ? error.message : 'Falha ao iniciar o envio',
    })
  }
}

export async function getSendJobHandler(request: FastifyRequest, reply: FastifyReply) {
  const { jobId } = request.params as { jobId: string }
  const snapshot = getSendJob(jobId)
  if (!snapshot) {
    return reply.status(404).send({ success: false, message: 'Job de envio não encontrado.' })
  }
  return reply.send(snapshot)
}

export async function pauseSendJobHandler(request: FastifyRequest, reply: FastifyReply) {
  const { jobId } = request.params as { jobId: string }
  const snapshot = pauseSendJob(jobId)
  if (!snapshot) {
    return reply.status(404).send({ success: false, message: 'Job de envio não encontrado.' })
  }
  return reply.send(snapshot)
}

export async function resumeSendJobHandler(request: FastifyRequest, reply: FastifyReply) {
  const { jobId } = request.params as { jobId: string }
  const snapshot = resumeSendJob(jobId)
  if (!snapshot) {
    return reply.status(404).send({ success: false, message: 'Job de envio não encontrado.' })
  }
  return reply.send(snapshot)
}

export async function cancelSendJobHandler(request: FastifyRequest, reply: FastifyReply) {
  const { jobId } = request.params as { jobId: string }
  const snapshot = cancelSendJob(jobId)
  if (!snapshot) {
    return reply.status(404).send({ success: false, message: 'Job de envio não encontrado.' })
  }
  return reply.send(snapshot)
}

export async function retryFailedSendJobHandler(request: FastifyRequest, reply: FastifyReply) {
  const { jobId } = request.params as { jobId: string }
  const snapshot = retryFailedSendJob(jobId)
  if (!snapshot) {
    return reply.status(404).send({ success: false, message: 'Job de envio não encontrado.' })
  }
  return reply.send(snapshot)
}

export async function downloadSkippedProductsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { jobId } = request.params as { jobId: string }
  const csv = buildSkippedProductsCsv(jobId)
  if (csv === null) {
    return reply.status(404).send({ success: false, message: 'Job de envio não encontrado.' })
  }
  return reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header(
      'Content-Disposition',
      `attachment; filename="produtos-ignorados-${jobId.slice(0, 8)}.csv"`
    )
    .send(csv)
}
