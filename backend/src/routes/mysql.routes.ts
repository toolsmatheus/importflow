import type { FastifyInstance } from 'fastify'
import {
  disconnectHandler,
  getTableColumnsHandler,
  getTablesHandler,
  testConnectionHandler,
} from '../controllers/mysql.controller.js'

export async function mysqlRoutes(app: FastifyInstance) {
  app.post('/mysql/test', testConnectionHandler)
  app.get('/mysql/tables', getTablesHandler)
  app.get('/mysql/tables/:table/columns', getTableColumnsHandler)
  app.delete('/mysql/session/:sessionId', disconnectHandler)
}
