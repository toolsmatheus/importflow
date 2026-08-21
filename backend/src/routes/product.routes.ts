import type { FastifyInstance } from 'fastify'
import {
  cancelSendJobHandler,
  downloadAuxiliaryTemplateHandler,
  downloadProductTemplateHandler,
  getProductFieldCatalogHandler,
  getSendJobHandler,
  identifyServerHandler,
  pauseSendJobHandler,
  resumeSendJobHandler,
  retryFailedSendJobHandler,
  startSendJobHandler,
  uploadAuxiliaryHandler,
  validateProductHandler,
  validateProductRowsHandler,
} from '../controllers/product.controller.js'

export async function productRoutes(app: FastifyInstance) {
  app.get('/products/template', downloadProductTemplateHandler)
  app.get('/products/template/auxiliar/:entity', downloadAuxiliaryTemplateHandler)
  app.get('/products/catalog', getProductFieldCatalogHandler)
  app.post('/products/auxiliary/:entity', uploadAuxiliaryHandler)
  app.post('/products/validate', validateProductHandler)
  app.post('/products/validate-rows', validateProductRowsHandler)
  app.get('/products/identify-server', identifyServerHandler)
  app.post('/products/send/start', startSendJobHandler)
  app.get('/products/send/:jobId', getSendJobHandler)
  app.post('/products/send/:jobId/pause', pauseSendJobHandler)
  app.post('/products/send/:jobId/resume', resumeSendJobHandler)
  app.post('/products/send/:jobId/cancel', cancelSendJobHandler)
  app.post('/products/send/:jobId/retry-failures', retryFailedSendJobHandler)
}
