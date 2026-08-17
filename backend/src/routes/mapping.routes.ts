import type { FastifyInstance } from 'fastify'
import { suggestMappingHandler } from '../controllers/mapping.controller.js'

export async function mappingRoutes(app: FastifyInstance) {
  app.post('/mapping/suggest', suggestMappingHandler)
}
