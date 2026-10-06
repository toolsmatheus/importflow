import type { FastifyInstance } from 'fastify'
import {
  cancelarEnvioJobHandler,
  collectFolderHandler,
  downloadAuxiliaryTemplateHandler,
  downloadProductTemplateHandler,
  downloadSkippedProductsHandler,
  getFolderExpectHandler,
  getProductFieldCatalogHandler,
  obterEnvioJobHandler,
  identifyServerHandler,
  pausarEnvioJobHandler,
  previewAuxiliaryHandler,
  retomarEnvioJobHandler,
  reenviarFalhasEnvioJobHandler,
  startSendJobHandler,
  sugerirControladosHandler,
  uploadAuxiliaryHandler,
  validateProductHandler,
  validarLinhasProdutoHandler,
} from '../controller/produto.controller.js'

export async function productRoutes(app: FastifyInstance) {
  app.get('/products/template', downloadProductTemplateHandler)
  app.get('/products/template/auxiliar/:entity', downloadAuxiliaryTemplateHandler)
  app.get('/products/catalog', getProductFieldCatalogHandler)
  app.get('/products/folder-expect', getFolderExpectHandler)
  app.post('/products/collect-folder', collectFolderHandler)
  app.get('/products/auxiliary/preview/:fileId', previewAuxiliaryHandler)
  app.post('/products/auxiliary/:entity', uploadAuxiliaryHandler)
  app.post('/products/validate', validateProductHandler)
  app.post('/products/validate-rows', validarLinhasProdutoHandler)
  app.post('/products/suggest-controlados', sugerirControladosHandler)
  app.get('/products/identify-server', identifyServerHandler)
  app.post('/products/send/start', startSendJobHandler)
  app.get('/products/send/:jobId', obterEnvioJobHandler)
  app.get('/products/send/:jobId/skipped.csv', downloadSkippedProductsHandler)
  app.post('/products/send/:jobId/pause', pausarEnvioJobHandler)
  app.post('/products/send/:jobId/resume', retomarEnvioJobHandler)
  app.post('/products/send/:jobId/cancel', cancelarEnvioJobHandler)
  app.post('/products/send/:jobId/retry-failures', reenviarFalhasEnvioJobHandler)
}
