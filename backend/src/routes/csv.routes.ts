import type { FastifyInstance } from 'fastify'
import {
  deleteCsvHandler,
  reanalyzeCsvHandler,
  uploadCsvHandler,
} from '../controller/csv.controller.js'

export async function csvRoutes(app: FastifyInstance) {
  app.post('/csv/upload', uploadCsvHandler)
  app.post('/csv/analyze', reanalyzeCsvHandler)
  app.delete('/csv/file/:fileId', deleteCsvHandler)
}
