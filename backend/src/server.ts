import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import { registerRoutes } from './routes/index.js'
import { discardOrphanedFiles, startFileCleanupTimer } from './services/csvFileService.js'

const app = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    },
  },
})

await app.register(cors, {
  origin: true,
})

await app.register(multipart, {
  limits: {
    fileSize: 500 * 1024 * 1024,
  },
})

await registerRoutes(app)

const PORT = Number(process.env.PORT) || 3001

try {
  const orphaned = await discardOrphanedFiles()
  if (orphaned > 0) {
    app.log.info({ count: orphaned }, 'Orphaned upload files discarded')
  }

  startFileCleanupTimer()

  await app.listen({ port: PORT, host: '0.0.0.0' })
  app.log.info(`ImportFlow backend running on http://localhost:${PORT}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
