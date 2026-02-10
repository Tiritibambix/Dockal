import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { AuthPayload } from '../types.js'

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: AuthPayload }>('/auth/login', async (request, reply) => {
    const { username, password } = request.body

    if (!username || !password) {
      return reply.status(400).send({ error: 'Missing credentials' })
    }

    // In production, validate against Radicale or a separate user DB
    const token = fastify.jwt.sign(
      { username },
      { expiresIn: '7d' }
    )

    return reply.send({ token, username })
  })
}
