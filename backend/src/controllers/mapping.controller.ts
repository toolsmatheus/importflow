import type { FastifyReply, FastifyRequest } from 'fastify'
import { suggestMappingSchema } from '../schemas/mapping.schema.js'
import { suggestMappings } from '../services/mappingService.js'

export async function suggestMappingHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = suggestMappingSchema.safeParse(request.body)

  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      message: 'Dados de mapeamento inválidos.',
      errors: parsed.error.flatten().fieldErrors,
    })
  }

  const mappings = suggestMappings(parsed.data.csvColumns, parsed.data.mysqlColumns)

  return reply.send({ mappings })
}
