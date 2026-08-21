import { existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { registerRoutes } from './routes/index.js'
import { discardOrphanedFiles, startFileCleanupTimer } from './services/csvFileService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
  // Importações de 5k–20k produtos exigem body grande no start do job.
  bodyLimit: 80 * 1024 * 1024,
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

const frontendDistCandidates = [
  path.resolve(__dirname, '../../frontend/dist'),
  path.resolve(process.cwd(), '../frontend/dist'),
  path.resolve(process.cwd(), 'frontend/dist'),
]

const frontendDist = frontendDistCandidates.find((candidate) =>
  existsSync(path.join(candidate, 'index.html'))
)

if (frontendDist) {
  await app.register(fastifyStatic, {
    root: frontendDist,
    wildcard: false,
  })

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api')) {
      return reply.status(404).send({ success: false, message: 'Rota não encontrada.' })
    }
    return reply.sendFile('index.html')
  })

  app.log.info({ frontendDist }, 'Serving frontend static files')
} else {
  app.log.warn(
    'Frontend build not found (frontend/dist). Run npm run build before start.bat for single-process mode.'
  )
}

const PORT = Number(process.env.PORT) || 3001

try {
  const orphaned = await discardOrphanedFiles()
  if (orphaned > 0) {
    app.log.info({ count: orphaned }, 'Orphaned upload files discarded')
  }

  startFileCleanupTimer()

  await app.listen({ port: PORT, host: '0.0.0.0' })
  app.log.info(`ImportFlow running on http://localhost:${PORT}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
