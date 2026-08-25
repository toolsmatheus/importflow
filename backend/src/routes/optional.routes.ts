import type { FastifyInstance } from 'fastify'
import {
  barcodeTemplateHandler,
  cancelBarcodeSendHandler,
  cancelSupplierSendHandler,
  getBarcodeSendHandler,
  getSupplierSendHandler,
  startBarcodeSendHandler,
  startSupplierSendHandler,
  supplierTemplateHandler,
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
}
