import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { CalDAVClient } from '../caldav/client.js'

export async function calendarsRoutes(fastify: FastifyInstance, caldavClient: CalDAVClient) {
  // GET /calendars
  fastify.get(
    '/calendars',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        console.log('[GET /calendars] Listing calendars')
        const calendars = await caldavClient.listCalendars()
        console.log(`[GET /calendars] Found ${calendars.length} calendars`)
        return reply.send({ calendars })
      } catch (err) {
        console.error(`[GET /calendars] Error: ${String(err)}`)
        return reply.status(500).send({ error: 'Failed to list calendars', details: String(err) })
      }
    }
  )
}
