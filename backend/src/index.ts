import 'dotenv/config'
import Fastify, { FastifyInstance } from 'fastify'
import fastifyJwt from '@fastify/jwt'
import fastifyCors from '@fastify/cors'
import { CalDAVClient } from './caldav/client.js'
import { authRoutes } from './routes/auth.js'
import { eventsRoutes } from './routes/events.js'
import { calendarsRoutes } from './routes/calendars.js'

const {
  RADICALE_URL = 'http://radicale:5232',
  RADICALE_USERNAME = 'user',
  RADICALE_PASSWORD = 'password',
  JWT_SECRET = 'dev-secret-key',
  PORT = '3000',
  FRONTEND_URL = 'http://localhost:5173',
} = process.env

const fastify: FastifyInstance = Fastify({ logger: true })

// Register CORS FIRST, before other plugins
fastify.register(fastifyCors, {
  origin: true, // Allow all origins in development, or specify: FRONTEND_URL
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
})

// JWT authentication plugin
fastify.register(fastifyJwt, { secret: JWT_SECRET })

// Decorator for routes to use
fastify.decorate('authenticate', async function (request: any, reply: any) {
  try {
    await request.jwtVerify()
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized' })
  }
})

const caldavClient = new CalDAVClient(
  RADICALE_URL,
  RADICALE_USERNAME,
  RADICALE_PASSWORD
)

// Routes
fastify.register((f: FastifyInstance) => authRoutes(f))
fastify.register((f: FastifyInstance) => eventsRoutes(f, caldavClient))
fastify.register((f: FastifyInstance) => calendarsRoutes(f, caldavClient))

// Health check (no auth required)
fastify.get('/health', async (request, reply) => {
  fastify.log.info('[GET /health] Health check')
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
    fastify.log.error(`Startup error: ${String(err)}`)
    process.exit(1)
  }
}

start()
