import type { FastifyInstance } from 'fastify'
import {
  getImportErrorsHandler,
  getImportResultHandler,
  getImportStatusHandler,
  startImportHandler,
  validateImportHandler,
} from '../controllers/import.controller.js'

export async function importRoutes(app: FastifyInstance) {
  app.post('/import/validate', validateImportHandler)
  app.post('/import/start', startImportHandler)
  app.get('/import/status/:id', getImportStatusHandler)
  app.get('/import/:id/result', getImportResultHandler)
  app.get('/import/:id/errors', getImportErrorsHandler)
}
