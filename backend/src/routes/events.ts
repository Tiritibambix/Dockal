import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { CalendarEvent, CopyEventPayload, CopyEventResult } from '../types.js';
import { CalDAVClient } from '../caldav/client.js';

export function eventsRoutes(fastify: FastifyInstance, caldavClient: CalDAVClient) {
  // GET /events?from=2026-01-01&to=2026-12-31
  fastify.get('/events', { onRequest: [fastify.authenticate] }, async (request, reply) => {
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
  fastify.post('/events', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const body = request.body as unknown;
    const event: CalendarEvent = {
      uid: '',
      title: (body as any).title || '',
      start: (body as any).start || new Date(),
      end: (body as any).end || new Date(),
      allDay: (body as any).allDay || false,
      timezone: (body as any).timezone || 'UTC'
    };
    reply.code(201).send(await createEvent(event));
  });

  // PUT /events/:uid
  fastify.put('/events/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const params = request.params as Record<string, unknown>;
    const body = request.body as unknown;
    const id = params.id as string;
    const event: CalendarEvent = {
      uid: id,
      title: (body as any).title || '',
      start: (body as any).start || new Date(),
      end: (body as any).end || new Date(),
      allDay: (body as any).allDay || false,
      timezone: (body as any).timezone || 'UTC'
    };
    reply.send(await updateEvent(id, event));
  });

  // DELETE /events/:uid
  fastify.delete('/events/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const params = request.params as Record<string, unknown>;
    const id = params.id as string;
    reply.send(await deleteEvent(id));
  });

  // 🟦 COPY EVENT FEATURE
  // POST /events/:uid/copy
  fastify.post<{ Params: { uid: string }; Body: CopyEventPayload }>(
    '/events/:uid/copy',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
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
  fastify.get('/events/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const params = request.params as Record<string, unknown>;
    const id = params.id as string;
    reply.send(await getEvent(id));
  });
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

async function createEvent(event: CalendarEvent): Promise<CalendarEvent> {
  // TODO: Implement event creation logic
  return event;
}

async function updateEvent(id: string, event: CalendarEvent): Promise<CalendarEvent> {
  // TODO: Implement event update logic
  return event;
}

async function deleteEvent(id: string): Promise<{ success: boolean }> {
  // TODO: Implement event deletion logic
  return { success: true };
}

async function getEvent(id: string): Promise<CalendarEvent | null> {
  // TODO: Implement event retrieval logic
  return null;
}
