import { FastifyInstance } from 'fastify'
import { healthRoutes } from './health.routes.js'
import { mysqlRoutes } from './mysql.routes.js'
import { csvRoutes } from './csv.routes.js'
import { mappingRoutes } from './mapping.routes.js'
import { importRoutes } from './import.routes.js'

export async function registerRoutes(app: FastifyInstance) {
  await app.register(healthRoutes, { prefix: '/api' })
  await app.register(mysqlRoutes, { prefix: '/api' })
  await app.register(csvRoutes, { prefix: '/api' })
  await app.register(mappingRoutes, { prefix: '/api' })
  await app.register(importRoutes, { prefix: '/api' })
}
