import Fastify from 'fastify'
import fastifyJwt from '@fastify/jwt'
import fastifyCors from '@fastify/cors'
import { config } from 'dotenv'
import { CalDAVClient } from './caldav/client.js'
import { authRoutes } from './routes/auth.js'
import { eventsRoutes } from './routes/events.js'
import { calendarsRoutes } from './routes/calendars.js'

config()

const {
  RADICALE_URL = 'http://localhost:5232',
  RADICALE_USERNAME = 'user',
  RADICALE_PASSWORD = 'password',
  JWT_SECRET = 'dev-secret-key',
  PORT = '3000',
  FRONTEND_URL = 'http://localhost:5173',
} = process.env

const fastify = Fastify({ logger: true })

// Register plugins
fastify.register(fastifyJwt, { secret: JWT_SECRET })
fastify.register(fastifyCors, {
  origin: FRONTEND_URL,
  credentials: true,
})

// CalDAV client
const caldavClient = new CalDAVClient(
  RADICALE_URL,
  RADICALE_USERNAME,
  RADICALE_PASSWORD
)

// JWT auth decorator
fastify.decorate('authenticate', async function (request, reply) {
  try {
    await request.jwtVerify()
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' })
  }
})

// Routes
fastify.register((f) => authRoutes(f))
fastify.register((f) => eventsRoutes(f, caldavClient))
fastify.register((f) => calendarsRoutes(f, caldavClient))

// Health check
fastify.get('/health', (request, reply) => {
  return reply.send({ status: 'ok' })
})

// Startup
const start = async () => {
  try {
    await caldavClient.initialize()
    fastify.log.info('CalDAV client initialized')

    await fastify.listen({ port: parseInt(PORT), host: '0.0.0.0' })
    fastify.log.info(`Backend running at http://0.0.0.0:${PORT}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
