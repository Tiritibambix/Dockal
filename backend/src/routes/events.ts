import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { v4 as uuidv4 } from 'uuid'
import { CalendarEvent, CopyEventPayload } from '../types.js'
import { CalDAVClient } from '../caldav/client.js'

export async function eventsRoutes(fastify: FastifyInstance, caldavClient: CalDAVClient) {
  // GET /events?from=2026-01-01&to=2026-12-31
  fastify.get<{ Querystring: { from: string; to: string } }>(
    '/events',
    { onRequest: [fastify.authenticate] },
    async (request: FastifyRequest<{ Querystring: { from: string; to: string } }>, reply: FastifyReply) => {
      try {
        fastify.log.info(`[GET /events] from=${request.query.from} to=${request.query.to}`)
        
        const from = new Date(request.query.from)
        const to = new Date(request.query.to)

        if (isNaN(from.getTime()) || isNaN(to.getTime())) {
          return reply.status(400).send({ error: 'Invalid date format' })
        }

        const events = await caldavClient.getEvents(from, to)
        fastify.log.info(`[GET /events] Found ${events.length} events`)
        return reply.send({ events })
      } catch (err) {
        fastify.log.error(`[GET /events] Error: ${String(err)}`)
        return reply.status(500).send({ error: 'Failed to fetch events', details: String(err) })
      }
    }
  )

  // POST /events
  fastify.post<{ Body: Omit<CalendarEvent, 'uid'> }>(
    '/events',
    { onRequest: [fastify.authenticate] },
    async (request: FastifyRequest<{ Body: Omit<CalendarEvent, 'uid'> }>, reply: FastifyReply) => {
      try {
        fastify.log.info(`[POST /events] Creating event: ${JSON.stringify(request.body)}`)
        
        const body = request.body
        const newEvent: CalendarEvent = {
          uid: uuidv4(),
          title: body.title || '',
          description: body.description,
          location: body.location,
          start: new Date(body.start || new Date()),
          end: new Date(body.end || new Date()),
          allDay: body.allDay || false,
          timezone: body.timezone || 'UTC',
        }

        fastify.log.info(`[POST /events] Generated event: ${JSON.stringify(newEvent)}`)
        await caldavClient.createEvent(newEvent)
        fastify.log.info(`[POST /events] Event created successfully`)
        return reply.code(201).send(newEvent)
      } catch (err) {
        fastify.log.error(`[POST /events] Error: ${String(err)}`)
        return reply.status(500).send({ error: 'Failed to create event', details: String(err) })
      }
    }
  )

  // PUT /events/:id
  fastify.put<{ Params: { id: string }; Body: CalendarEvent }>(
    '/events/:id',
    { onRequest: [fastify.authenticate] },
    async (request: FastifyRequest<{ Params: { id: string }; Body: CalendarEvent }>, reply: FastifyReply) => {
      try {
        fastify.log.info(`[PUT /events/:id] Updating event ${request.params.id}: ${JSON.stringify(request.body)}`)
        
        const id = request.params.id
        const body = request.body
        const event: CalendarEvent = {
          uid: id,
          title: body.title || '',
          description: body.description,
          location: body.location,
          start: new Date(body.start || new Date()),
          end: new Date(body.end || new Date()),
          allDay: body.allDay || false,
          timezone: body.timezone || 'UTC',
        }

        await caldavClient.updateEvent(event)
        fastify.log.info(`[PUT /events/:id] Event ${id} updated successfully`)
        return reply.send(event)
      } catch (err) {
        fastify.log.error(`[PUT /events/:id] Error: ${String(err)}`)
        return reply.status(500).send({ error: 'Failed to update event', details: String(err) })
      }
    }
  )

  // DELETE /events/:id
  fastify.delete<{ Params: { id: string } }>(
    '/events/:id',
    { onRequest: [fastify.authenticate] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        fastify.log.info(`[DELETE /events/:id] Deleting event ${request.params.id}`)
        
        const id = request.params.id
        await caldavClient.deleteEvent(id)
        fastify.log.info(`[DELETE /events/:id] Event ${id} deleted successfully`)
        return reply.send({ success: true })
      } catch (err) {
        fastify.log.error(`[DELETE /events/:id] Error: ${String(err)}`)
        return reply.status(500).send({ error: 'Failed to delete event', details: String(err) })
      }
    }
  )

  // POST /events/:uid/copy
  fastify.post<{ Params: { uid: string }; Body: CopyEventPayload }>(
    '/events/:uid/copy',
    { onRequest: [fastify.authenticate] },
    async (request: FastifyRequest<{ Params: { uid: string }; Body: CopyEventPayload }>, reply: FastifyReply) => {
      try {
        fastify.log.info(`[POST /events/:uid/copy] Copying event ${request.params.uid}: ${JSON.stringify(request.body)}`)
        
        const sourceEvent = await caldavClient.getEventByUid(request.params.uid)
        if (!sourceEvent) {
          return reply.status(404).send({ error: 'Source event not found' })
        }

        const { dates } = request.body
        if (!dates || dates.length === 0) {
          return reply.status(400).send({ error: 'No dates provided' })
        }

        const copiedEvents: CalendarEvent[] = []

        for (const dateStr of dates) {
          const targetDate = new Date(dateStr)
          if (isNaN(targetDate.getTime())) {
            fastify.log.warn(`[POST /events/:uid/copy] Invalid date: ${dateStr}`)
            continue
          }

          const newEvent = copyEventToDate(sourceEvent, targetDate)
          await caldavClient.createEvent(newEvent)
          copiedEvents.push(newEvent)
        }

        fastify.log.info(`[POST /events/:uid/copy] Event copied to ${copiedEvents.length} dates`)
        return reply.status(201).send({ copiedEvents, sourceUid: sourceEvent.uid })
      } catch (err) {
        fastify.log.error(`[POST /events/:uid/copy] Error: ${String(err)}`)
        return reply.status(500).send({ error: 'Failed to copy event', details: String(err) })
      }
    }
  )

  // GET /events/:uid
  fastify.get<{ Params: { id: string } }>(
    '/events/:id',
    { onRequest: [fastify.authenticate] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const id = request.params.id
      try {
        const ev = await caldavClient.getEventByUid(id)
        if (!ev) return reply.status(404).send({ error: 'Event not found' })
        return reply.send(ev)
      } catch (err) {
        fastify.log.error(`[GET /events/:id] Error: ${String(err)}`)
        return reply.status(500).send({ error: 'Failed to fetch event', details: String(err) })
      }
    }
  )
}

/**
 * Copy event to a new date, preserving duration and timezone.
 * NEVER copy RRULE.
 */
function copyEventToDate(source: CalendarEvent, targetDate: Date): CalendarEvent {
  const duration = source.end.getTime() - source.start.getTime()
  const sourceStart = new Date(source.start)

  targetDate.setHours(
    sourceStart.getHours(),
    sourceStart.getMinutes(),
    sourceStart.getSeconds(),
    sourceStart.getMilliseconds()
  )

  const newStart = new Date(targetDate)
  const newEnd = new Date(newStart.getTime() + duration)

  return {
    uid: uuidv4(),
    title: source.title,
    description: source.description,
    location: source.location,
    start: newStart,
    end: newEnd,
    allDay: source.allDay,
    timezone: source.timezone,
  }
}
