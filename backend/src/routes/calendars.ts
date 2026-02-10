import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { CalDAVClient } from '../caldav/client.js'

export function calendarsRoutes(fastify: FastifyInstance, caldavClient: CalDAVClient) {
  fastify.get(
    '/calendars',
    { onRequest: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const calendars = await caldavClient.listCalendars()
        return reply.send({ calendars })
      } catch (err) {
        fastify.log.error(err)
        return reply.status(500).send({ error: 'Failed to list calendars' })
      }
    }
  )
}
