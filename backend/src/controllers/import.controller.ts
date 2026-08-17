import type { FastifyReply, FastifyRequest } from 'fastify'
import { startImportSchema, validateImportSchema } from '../schemas/import.schema.js'
import { runValidation, startImport } from '../services/importService.js'
import {
  getJob,
  toProgressPayload,
  toResultPayload,
} from '../services/importJobService.js'
import { getSessionIdFromRequest, isValidIdentifier } from '../utils/session.js'

export async function validateImportHandler(request: FastifyRequest, reply: FastifyReply) {
  const sessionId = getSessionIdFromRequest(request.headers)

  if (!sessionId) {
    return reply
      .status(401)
      .send({ success: false, message: 'Sessão não informada. Teste a conexão novamente.' })
  }

  const parsed = validateImportSchema.safeParse(request.body)

  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      message: 'Parâmetros de validação inválidos.',
      errors: parsed.error.flatten().fieldErrors,
    })
  }

  if (!isValidIdentifier(parsed.data.table)) {
    return reply.status(400).send({ success: false, message: 'Nome de tabela inválido.' })
  }

  try {
    const result = await runValidation(sessionId, parsed.data)

    if (!result.success) {
      return reply.status(result.status).send({ success: false, message: result.message })
    }

    request.log.info(
      {
        table: parsed.data.table,
        totalRecords: result.data.totalRecords,
        validCount: result.data.validCount,
        warningCount: result.data.warningCount,
        invalidCount: result.data.invalidCount,
      },
      'Import validated'
    )

    return reply.send(result.data)
  } catch (error) {
    request.log.error({ err: error, table: parsed.data.table }, 'Import validation failed')
    return reply.status(500).send({ success: false, message: 'Erro ao validar os dados.' })
  }
}

export async function startImportHandler(request: FastifyRequest, reply: FastifyReply) {
  const sessionId = getSessionIdFromRequest(request.headers)

  if (!sessionId) {
    return reply
      .status(401)
      .send({ success: false, message: 'Sessão não informada. Teste a conexão novamente.' })
  }

  const parsed = startImportSchema.safeParse(request.body)

  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      message: 'Parâmetros da importação inválidos.',
      errors: parsed.error.flatten().fieldErrors,
    })
  }

  if (!isValidIdentifier(parsed.data.table)) {
    return reply.status(400).send({ success: false, message: 'Nome de tabela inválido.' })
  }

  try {
    const result = await startImport(sessionId, parsed.data, (job) => {
      request.log.info(
        {
          importId: job.id,
          table: job.table,
          mode: job.mode,
          status: job.status,
          processed: job.processed,
          inserted: job.inserted,
          updated: job.updated,
          skipped: job.skipped,
          errors: job.errorCount,
        },
        'Import finished'
      )
    })

    if (!result.success) {
      return reply.status(result.status).send({ success: false, message: result.message })
    }

    request.log.info(
      { importId: result.data.id, table: parsed.data.table, mode: parsed.data.mode },
      'Import started'
    )

    return reply.status(202).send({ importId: result.data.id })
  } catch (error) {
    request.log.error({ err: error, table: parsed.data.table }, 'Import start failed')
    return reply.status(500).send({ success: false, message: 'Erro ao iniciar a importação.' })
  }
}

function requireJob(request: FastifyRequest, reply: FastifyReply) {
  const sessionId = getSessionIdFromRequest(request.headers)

  if (!sessionId) {
    reply.status(401).send({ success: false, message: 'Sessão não informada.' })
    return null
  }

  const { id } = request.params as { id: string }
  const job = getJob(id)

  if (!job) {
    reply.status(404).send({ success: false, message: 'Importação não encontrada.' })
    return null
  }

  return job
}

export async function getImportStatusHandler(request: FastifyRequest, reply: FastifyReply) {
  const job = requireJob(request, reply)
  if (!job) return

  return reply.send(toProgressPayload(job))
}

export async function getImportResultHandler(request: FastifyRequest, reply: FastifyReply) {
  const job = requireJob(request, reply)
  if (!job) return

  if (job.status === 'pending' || job.status === 'running') {
    return reply.status(409).send({ success: false, message: 'A importação ainda está em execução.' })
  }

  return reply.send(toResultPayload(job))
}

export async function getImportErrorsHandler(request: FastifyRequest, reply: FastifyReply) {
  const job = requireJob(request, reply)
  if (!job) return

  return reply.send({
    total: job.errorCount,
    truncated: job.errorCount > job.errors.length,
    errors: job.errors,
  })
}
