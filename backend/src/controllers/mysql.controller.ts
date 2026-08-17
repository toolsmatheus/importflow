import type { FastifyReply, FastifyRequest } from 'fastify'
import { connectionConfigSchema } from '../schemas/mysql.schema.js'
import { closeSession, getTableColumns, getTables, testConnection } from '../services/mysqlService.js'
import { getSessionIdFromRequest, isValidIdentifier } from '../utils/session.js'

export async function testConnectionHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const parsed = connectionConfigSchema.safeParse(request.body)

  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      message: 'Dados de conexão inválidos.',
      errors: parsed.error.flatten().fieldErrors,
    })
  }

  const result = await testConnection(parsed.data)

  if (!result.success) {
    request.log.warn({ host: parsed.data.host, port: parsed.data.port, database: parsed.data.database }, 'MySQL connection failed')
    return reply.status(200).send(result)
  }

  request.log.info(
    { host: result.host, port: result.port, database: result.database, responseTimeMs: result.responseTimeMs },
    'MySQL connection successful'
  )

  return reply.send(result)
}

export async function disconnectHandler(
  request: FastifyRequest<{ Params: { sessionId: string } }>,
  reply: FastifyReply
) {
  const { sessionId } = request.params
  const removed = closeSession(sessionId)

  if (!removed) {
    return reply.status(404).send({ success: false, message: 'Sessão não encontrada.' })
  }

  return reply.send({ success: true })
}

export async function getTablesHandler(request: FastifyRequest, reply: FastifyReply) {
  const sessionId = getSessionIdFromRequest(request.headers)

  if (!sessionId) {
    return reply.status(401).send({ success: false, message: 'Sessão não informada. Teste a conexão novamente.' })
  }

  const result = await getTables(sessionId)

  if (!result.success) {
    return reply.status(result.status).send({ success: false, message: result.message })
  }

  return reply.send(result.tables)
}

export async function getTableColumnsHandler(
  request: FastifyRequest<{ Params: { table: string } }>,
  reply: FastifyReply
) {
  const sessionId = getSessionIdFromRequest(request.headers)

  if (!sessionId) {
    return reply.status(401).send({ success: false, message: 'Sessão não informada. Teste a conexão novamente.' })
  }

  const { table } = request.params

  if (!isValidIdentifier(table)) {
    return reply.status(400).send({ success: false, message: 'Nome de tabela inválido.' })
  }

  const result = await getTableColumns(sessionId, table)

  if (!result.success) {
    return reply.status(result.status).send({ success: false, message: result.message })
  }

  return reply.send(result.columns)
}
