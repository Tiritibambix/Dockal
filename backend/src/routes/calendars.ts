import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { CalDAVClient } from '../caldav/client.js'

export function calendarsRoutes(fastify: FastifyInstance, caldavClient: CalDAVClient) {
  fastify.get(
    '/calendars',
    { onRequest: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        fastify.log.info(`[GET /calendars] Listing calendars`)
        const calendars = await caldavClient.listCalendars()
        fastify.log.info(`[GET /calendars] Found ${calendars?.length || 0} calendars`)
        return reply.send({ calendars })
      } catch (err) {
        fastify.log.error(`[GET /calendars] Error: ${String(err)}`)
        return reply.status(500).send({ error: 'Failed to list calendars', details: String(err) })
      }
    }
  )
}
