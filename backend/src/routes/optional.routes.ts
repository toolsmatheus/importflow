import type { FastifyInstance } from 'fastify'
import {
  barcodeTemplateHandler,
  cancelBarcodeSendHandler,
  cancelStockSendHandler,
  cancelSupplierSendHandler,
  cancelValiditySendHandler,
  getBarcodeSendHandler,
  getStockSendHandler,
  getSupplierSendHandler,
  getValiditySendHandler,
  startBarcodeSendHandler,
  startStockSendHandler,
  startSupplierSendHandler,
  startValiditySendHandler,
  stockTemplateHandler,
  supplierTemplateHandler,
  validityTemplateHandler,
} from '../controllers/optional.controller.js'

export async function optionalRoutes(app: FastifyInstance) {
  app.get('/opcionais/barcodes/template', barcodeTemplateHandler)
  app.post('/opcionais/barcodes/send/start', startBarcodeSendHandler)
  app.get('/opcionais/barcodes/send/:jobId', getBarcodeSendHandler)
  app.post('/opcionais/barcodes/send/:jobId/cancel', cancelBarcodeSendHandler)

  app.get('/opcionais/supplier-refs/template', supplierTemplateHandler)
  app.post('/opcionais/supplier-refs/send/start', startSupplierSendHandler)
  app.get('/opcionais/supplier-refs/send/:jobId', getSupplierSendHandler)
  app.post('/opcionais/supplier-refs/send/:jobId/cancel', cancelSupplierSendHandler)

  app.get('/opcionais/validity/template', validityTemplateHandler)
  app.post('/opcionais/validity/send/start', startValiditySendHandler)
  app.get('/opcionais/validity/send/:jobId', getValiditySendHandler)
  app.post('/opcionais/validity/send/:jobId/cancel', cancelValiditySendHandler)

  app.get('/opcionais/stock/template', stockTemplateHandler)
  app.post('/opcionais/stock/send/start', startStockSendHandler)
  app.get('/opcionais/stock/send/:jobId', getStockSendHandler)
  app.post('/opcionais/stock/send/:jobId/cancel', cancelStockSendHandler)
}
