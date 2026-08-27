import type { FastifyInstance } from 'fastify'
import {
  cancelSendJobHandler,
  collectFolderHandler,
  downloadAuxiliaryTemplateHandler,
  downloadProductTemplateHandler,
  downloadSkippedProductsHandler,
  getFolderExpectHandler,
  getProductFieldCatalogHandler,
  getSendJobHandler,
  identifyServerHandler,
  pauseSendJobHandler,
  previewAuxiliaryHandler,
  resumeSendJobHandler,
  retryFailedSendJobHandler,
  startSendJobHandler,
  suggestControladosHandler,
  uploadAuxiliaryHandler,
  validateProductHandler,
  validateProductRowsHandler,
} from '../controllers/product.controller.js'

export async function productRoutes(app: FastifyInstance) {
  app.get('/products/template', downloadProductTemplateHandler)
  app.get('/products/template/auxiliar/:entity', downloadAuxiliaryTemplateHandler)
  app.get('/products/catalog', getProductFieldCatalogHandler)
  app.get('/products/folder-expect', getFolderExpectHandler)
  app.post('/products/collect-folder', collectFolderHandler)
  app.get('/products/auxiliary/preview/:fileId', previewAuxiliaryHandler)
  app.post('/products/auxiliary/:entity', uploadAuxiliaryHandler)
  app.post('/products/validate', validateProductHandler)
  app.post('/products/validate-rows', validateProductRowsHandler)
  app.post('/products/suggest-controlados', suggestControladosHandler)
  app.get('/products/identify-server', identifyServerHandler)
  app.post('/products/send/start', startSendJobHandler)
  app.get('/products/send/:jobId', getSendJobHandler)
  app.get('/products/send/:jobId/skipped.csv', downloadSkippedProductsHandler)
  app.post('/products/send/:jobId/pause', pauseSendJobHandler)
  app.post('/products/send/:jobId/resume', resumeSendJobHandler)
  app.post('/products/send/:jobId/cancel', cancelSendJobHandler)
  app.post('/products/send/:jobId/retry-failures', retryFailedSendJobHandler)
}
