import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { v4 as uuidv4 } from 'uuid'
import { CalendarEvent, CopyEventPayload, CopyEventResult } from '../types.js'
import { CalDAVClient } from '../caldav/client.js'

export function eventsRoutes(fastify: FastifyInstance, caldavClient: CalDAVClient) {
  // GET /events?from=2026-01-01&to=2026-12-31
  fastify.get('/events', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const query = request.query as { calendarId?: string };
    const calendarId = query.calendarId as string;

    try {
      const from = new Date(request.query.from)
      const to = new Date(request.query.to)

      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        return reply.status(400).send({ error: 'Invalid date format' })
      }

      const events = await caldavClient.getEvents(from, to)
      return reply.send({ events })
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Failed to fetch events' })
    }
  })

  // POST /events
  fastify.post('/events', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const body = request.body as Record<string, unknown>;

    try {
      const event: CalendarEvent = {
        ...body,
        uid: uuidv4(),
      }

      await caldavClient.createEvent(event)
      reply.code(201).send({ ...(body as object) });
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Failed to create event' })
    }
  })

  // PUT /events/:uid
  fastify.put('/events/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const event = request.body as CalendarEvent;
    const params = request.params as { id: string };

    try {
      event.uid = params.id

      await caldavClient.updateEvent(event)
      reply.send(await updateEvent(params.id, event));
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Failed to update event' })
    }
  })

  // DELETE /events/:uid
  fastify.delete('/events/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const params = request.params as { id: string };

    try {
      await caldavClient.deleteEvent(params.id)
      reply.send(await deleteEvent(params.id));
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Failed to delete event' })
    }
  })

  // 🟦 COPY EVENT FEATURE
  // POST /events/:uid/copy
  fastify.post<{ Params: { uid: string }; Body: CopyEventPayload }>(
    '/events/:uid/copy',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      try {
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
            fastify.log.warn(`Invalid date: ${dateStr}`)
            continue
          }

          const newEvent = copyEventToDate(sourceEvent, targetDate)
          await caldavClient.createEvent(newEvent)
          copiedEvents.push(newEvent)
        }

        const result: CopyEventResult = {
          copiedEvents,
          sourceUid: sourceEvent.uid,
        }

        return reply.status(201).send(result)
      } catch (err) {
        fastify.log.error(err)
        return reply.status(500).send({ error: 'Failed to copy event' })
      }
    }
  )

  // GET /events/:uid
  fastify.get('/events/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const params = request.params as { id: string };

    try {
      const event = await caldavClient.getEventByUid(params.id)
      if (!event) {
        return reply.status(404).send({ error: 'Event not found' })
      }

      reply.send(await getEvent(params.id));
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Failed to fetch event' })
    }
  })
}

/**
 * Copy event to a new date, preserving duration and timezone.
 * NEVER copy RRULE.
 */
function copyEventToDate(source: CalendarEvent, targetDate: Date): CalendarEvent {
  const duration = source.end.getTime() - source.start.getTime()
  const sourceStart = new Date(source.start)

  // Adjust target date to same time of day as source
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
    // NEVER copy rrule
  }
}
