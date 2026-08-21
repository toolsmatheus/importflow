import type { FastifyInstance } from 'fastify'
import { healthRoutes } from './health.routes.js'
import { csvRoutes } from './csv.routes.js'
import { productRoutes } from './product.routes.js'

export async function registerRoutes(app: FastifyInstance) {
  await app.register(healthRoutes, { prefix: '/api' })
  await app.register(csvRoutes, { prefix: '/api' })
  await app.register(productRoutes, { prefix: '/api' })
}
