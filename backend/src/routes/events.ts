import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { RouteGenericInterface } from 'fastify/types/route';
import { v4 as uuidv4 } from 'uuid';
import { CalendarEvent, CopyEventPayload, CopyEventResult } from '../types.js';
import { CalDAVClient } from '../caldav/client.js';

export function eventsRoutes(fastify: FastifyInstance, caldavClient: CalDAVClient) {
  // GET /events?from=2026-01-01&to=2026-12-31
  fastify.get<{ Querystring: { from: string; to: string; calendarId: string } }>('/events', { onRequest: [fastify.authenticate] }, async (request: FastifyRequest<{ Querystring: { from: string; to: string; calendarId: string } }>, reply: FastifyReply) => {
    const query = request.query as Record<string, any>;
    if (!query || typeof query.calendarId !== 'string') {
      return reply.code(400).send({ error: 'calendarId is required' });
    }
    const calendarId = query.calendarId;

    try {
      const from = new Date(request.query.from);
      const to = new Date(request.query.to);

      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        return reply.status(400).send({ error: 'Invalid date format' });
      }

      const events = await caldavClient.getEvents(from, to);
      return reply.send({ events });
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to fetch events' });
    }
  });

  // POST /events
  fastify.post<{ Body: Omit<CalendarEvent, 'uid'> }>(
    '/events',
    { onRequest: [fastify.authenticate] },
    async (request: FastifyRequest<{ Body: Omit<CalendarEvent, 'uid'> }>, reply: FastifyReply) => {
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

      try {
        await caldavClient.createEvent(newEvent)
        return reply.code(201).send(newEvent)
      } catch (err) {
        fastify.log.error(err)
        return reply.status(500).send({ error: 'Failed to create event' })
      }
    }
  )

  // PUT /events/:uid
  fastify.put<{ Params: { id: string }; Body: CalendarEvent }>(
    '/events/:id',
    { onRequest: [fastify.authenticate] },
    async (request: FastifyRequest<{ Params: { id: string }; Body: CalendarEvent }>, reply: FastifyReply) => {
      const id = request.params.id as string
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

      try {
        await caldavClient.updateEvent(event)
        return reply.send(event)
      } catch (err) {
        fastify.log.error(err)
        return reply.status(500).send({ error: 'Failed to update event' })
      }
    }
  )

  // DELETE /events/:uid
  fastify.delete<{ Params: { id: string } }>(
    '/events/:id',
    { onRequest: [fastify.authenticate] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const id = request.params.id as string
      try {
        await caldavClient.deleteEvent(id)
        return reply.send({ success: true })
      } catch (err) {
        fastify.log.error(err)
        return reply.status(500).send({ error: 'Failed to delete event' })
      }
    }
  )

  // 🟦 COPY EVENT FEATURE
  // POST /events/:uid/copy
  fastify.post<{ Params: { uid: string }; Body: CopyEventPayload }>(
    '/events/:uid/copy',
    { onRequest: [fastify.authenticate] },
    async (request: FastifyRequest<{ Params: { uid: string }; Body: CopyEventPayload }>, reply: FastifyReply) => {
      try {
        const sourceEvent = await caldavClient.getEventByUid(request.params.uid);
        if (!sourceEvent) {
          return reply.status(404).send({ error: 'Source event not found' });
        }

        const { dates } = request.body;
        if (!dates || dates.length === 0) {
          return reply.status(400).send({ error: 'No dates provided' });
        }

        const copiedEvents: CalendarEvent[] = [];

        for (const dateStr of dates) {
          const targetDate = new Date(dateStr);
          if (isNaN(targetDate.getTime())) {
            fastify.log.warn(`Invalid date: ${dateStr}`);
            continue;
          }

          const newEvent = copyEventToDate(sourceEvent, targetDate);
          await caldavClient.createEvent(newEvent);
          copiedEvents.push(newEvent);
        }

        const result: CopyEventResult = {
          copiedEvents,
          sourceUid: sourceEvent.uid,
        };

        return reply.status(201).send(result);
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: 'Failed to copy event' });
      }
    }
  );

  // GET /events/:uid
  fastify.get<{ Params: { id: string } }>(
    '/events/:id',
    { onRequest: [fastify.authenticate] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const id = request.params.id as string
      try {
        const ev = await caldavClient.getEventByUid(id)
        if (!ev) return reply.status(404).send({ error: 'Event not found' })
        return reply.send(ev)
      } catch (err) {
        fastify.log.error(err)
        return reply.status(500).send({ error: 'Failed to fetch event' })
      }
    }
  );
}

/**
 * Copy event to a new date, preserving duration and timezone.
 * NEVER copy RRULE.
 */
function copyEventToDate(source: CalendarEvent, targetDate: Date): CalendarEvent {
  const duration = source.end.getTime() - source.start.getTime();
  const sourceStart = new Date(source.start);

  // Adjust target date to same time of day as source
  targetDate.setHours(
    sourceStart.getHours(),
    sourceStart.getMinutes(),
    sourceStart.getSeconds(),
    sourceStart.getMilliseconds()
  );

  const newStart = new Date(targetDate);
  const newEnd = new Date(newStart.getTime() + duration);

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
  };
}
