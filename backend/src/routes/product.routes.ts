import type { FastifyInstance } from 'fastify'
import {
  downloadAuxiliaryTemplateHandler,
  downloadProductTemplateHandler,
  getProductFieldCatalogHandler,
  identifyServerHandler,
  sendProductsHandler,
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
  app.post('/products/send', sendProductsHandler)
}
