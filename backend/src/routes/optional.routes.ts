import type { FastifyInstance } from 'fastify'
import {
  barcodeExtraTemplateHandler,
  cancelBarcodeExtraSendHandler,
  cancelLotSendHandler,
  cancelStockSendHandler,
  cancelSupplierSendHandler,
  cancelValiditySendHandler,
  collectOptionalFolderHandler,
  getBarcodeExtraSendHandler,
  getLotSendHandler,
  getStockSendHandler,
  getSupplierSendHandler,
  getValiditySendHandler,
  lotTemplateHandler,
  startBarcodeExtraSendHandler,
  startLotSendHandler,
  startStockSendHandler,
  startSupplierSendHandler,
  startValiditySendHandler,
  stockTemplateHandler,
  supplierTemplateHandler,
  validityTemplateHandler,
} from '../controller/opcional.controller.js'

export async function optionalRoutes(app: FastifyInstance) {
  app.post('/opcionais/collect-folder', collectOptionalFolderHandler)
  app.post('/opcionais/coleta-pasta', collectOptionalFolderHandler)

  app.get('/opcionais/barcode-extras/template', barcodeExtraTemplateHandler)
  app.post('/opcionais/barcode-extras/send/start', startBarcodeExtraSendHandler)
  app.get('/opcionais/barcode-extras/send/:jobId', getBarcodeExtraSendHandler)
  app.post(
    '/opcionais/barcode-extras/send/:jobId/cancel',
    cancelBarcodeExtraSendHandler
  )

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

  app.get('/opcionais/lots/template', lotTemplateHandler)
  app.post('/opcionais/lots/send/start', startLotSendHandler)
  app.get('/opcionais/lots/send/:jobId', getLotSendHandler)
  app.post('/opcionais/lots/send/:jobId/cancel', cancelLotSendHandler)
}
