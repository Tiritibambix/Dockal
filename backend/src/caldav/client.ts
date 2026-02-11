import * as DAV from 'dav'
import ICAL from 'ical.js'
import { v4 as uuidv4 } from 'uuid'
import { CalendarEvent } from '../types.js'

export class CalDAVClient {
  private account: any
  private calendar: any
  private xhr: any

  constructor(
    private radicaleUrl: string,
    private username: string,
    private password: string,
  ) {}

  async initialize() {
    try {
      console.log('[CalDAV] Initializing client')
      const creds = new DAV.Credentials({ username: this.username, password: this.password })
      this.xhr = new DAV.transport.Basic(creds)

      this.account = await DAV.createAccount({
        server: this.radicaleUrl,
        xhr: this.xhr,
        accountType: 'caldav',
        loadCollections: true,
        loadObjects: false, // Don't load objects yet, we'll fetch them manually
      })

      const calendars = this.account.calendars || []
      this.calendar = calendars[0]
      
      if (!this.calendar) {
        throw new Error('No calendar found')
      }
      
      console.log(`[CalDAV] Initialized with calendar: ${this.calendar.displayName}`)
    } catch (err) {
      throw new Error(`CalDAV initialization failed: ${String(err)}`)
    }
  }

  async listCalendars() {
    try {
      console.log('[CalDAV] Listing calendars')
      return this.account.calendars || []
    } catch (err) {
      throw new Error(`Failed to list calendars: ${String(err)}`)
    }
  }

  async getEvents(from: Date, to: Date): Promise<CalendarEvent[]> {
    try {
      console.log(`[CalDAV] Getting events from ${from} to ${to}`)
      
      const events: CalendarEvent[] = []
      
      // Fetch calendar objects (just metadata)
      const objects = await DAV.listCalendarObjects({
        calendar: this.calendar,
      })
      
      console.log(`[CalDAV] Found ${objects.length} calendar objects`)

      for (let i = 0; i < objects.length; i++) {
        const obj = objects[i]
        try {
          // Fetch the actual ICS data for this object
          const icsData = await this.fetchCalendarObjectData(obj.url)
          
          if (!icsData) {
            console.warn(`[CalDAV] Object ${i} (${obj.url}) has no data`)
            continue
          }

          console.log(`[CalDAV] Parsing object ${i} (${obj.url})`)
          
          const jcal = ICAL.parse(icsData)
          const comp = new ICAL.Component(jcal)
          const vevent = comp.getFirstSubcomponent('VEVENT')

          if (vevent) {
            const event = this.parseEvent(vevent)
            events.push(event)
            console.log(`[CalDAV] Parsed event: ${event.title}`)
          }
        } catch (parseErr) {
          console.warn(`[CalDAV] Failed to parse object ${i}: ${String(parseErr)}`)
          continue
        }
      }

      console.log(`[CalDAV] Found ${events.length} events`)
      return events
    } catch (err) {
      console.error(`[CalDAV] Error fetching events: ${String(err)}`)
      return []
    }
  }

  async getEventByUid(uid: string): Promise<CalendarEvent | null> {
    try {
      console.log(`[CalDAV] Getting event by UID: ${uid}`)
      
      const objects = await DAV.listCalendarObjects({
        calendar: this.calendar,
      })

      for (const obj of objects) {
        try {
          const icsData = await this.fetchCalendarObjectData(obj.url)
          
          if (!icsData) continue

          const jcal = ICAL.parse(icsData)
          const comp = new ICAL.Component(jcal)
          const vevent = comp.getFirstSubcomponent('VEVENT')
          
          if (vevent && vevent.getFirstPropertyValue('uid') === uid) {
            return this.parseEvent(vevent)
          }
        } catch (parseErr) {
          continue
        }
      }
      return null
    } catch (err) {
      console.warn(`[CalDAV] Event not found: ${uid}`)
      return null
    }
  }

  async createEvent(event: CalendarEvent): Promise<void> {
    try {
      console.log(`[CalDAV] Creating event: ${event.uid}`)
      const ics = this.eventToICS(event)

      await DAV.createCalendarObject({
        calendar: this.calendar,
        filename: `${event.uid}.ics`,
        data: ics,
      })
      console.log(`[CalDAV] Event created: ${event.uid}`)
    } catch (err) {
      throw new Error(`Failed to create event: ${String(err)}`)
    }
  }

  async updateEvent(event: CalendarEvent): Promise<void> {
    try {
      console.log(`[CalDAV] Updating event: ${event.uid}`)
      const ics = this.eventToICS(event)

      await DAV.updateCalendarObject({
        calendarObject: {
          url: `${this.calendar.url}${event.uid}.ics`,
          data: ics,
        }
      })
      console.log(`[CalDAV] Event updated: ${event.uid}`)
    } catch (err) {
      throw new Error(`Failed to update event: ${String(err)}`)
    }
  }

  async deleteEvent(uid: string): Promise<void> {
    try {
      console.log(`[CalDAV] Deleting event: ${uid}`)
      
      await DAV.deleteCalendarObject({
        calendarObject: {
          url: `${this.calendar.url}${uid}.ics`,
        }
      })
      console.log(`[CalDAV] Event deleted: ${uid}`)
    } catch (err) {
      throw new Error(`Failed to delete event: ${String(err)}`)
    }
  }

  private async fetchCalendarObjectData(url: string): Promise<string | null> {
    try {
      const response = await this.xhr.request({
        url: url,
        method: 'GET',
        headers: {
          'Accept': 'text/calendar',
        }
      })

      if (response.status === 200) {
        const data = response.body || response.responseText || response.text
        return typeof data === 'string' ? data : data?.toString() || null
      }
      return null
    } catch (err) {
      console.error(`[CalDAV] Error fetching object ${url}: ${String(err)}`)
      return null
    }
  }

  private parseEvent(vevent: ICAL.Component): CalendarEvent {
    const uid = vevent.getFirstPropertyValue('uid') as string
    const summary = (vevent.getFirstPropertyValue('summary') as string) || ''
    const description = (vevent.getFirstPropertyValue('description') as string) || undefined
    const location = (vevent.getFirstPropertyValue('location') as string) || undefined
    const dtstart = vevent.getFirstPropertyValue('dtstart') as ICAL.Time
    const dtend = vevent.getFirstPropertyValue('dtend') as ICAL.Time
    const rrule = vevent.getFirstPropertyValue('rrule')
    const tzid = dtstart?.timezone || 'UTC'

    const start = new Date(dtstart.toJSDate())
    const end = new Date(dtend.toJSDate())
    const allDay = dtstart.isDate

    return {
      uid,
      title: summary,
      description,
      location,
      start,
      end,
      allDay,
      timezone: tzid,
      rrule: rrule ? rrule.toICALString() : undefined,
    }
  }

  private eventToICS(event: CalendarEvent): string {
    const comp = new ICAL.Component('VCALENDAR')
    comp.addPropertyWithValue('version', '2.0')
    comp.addPropertyWithValue('prodid', '-//Dockal//Dockal//EN')
    comp.addPropertyWithValue('calscale', 'GREGORIAN')

    const vevent = new ICAL.Component('VEVENT')
    vevent.addPropertyWithValue('uid', event.uid)
    vevent.addPropertyWithValue('summary', event.title)
    if (event.description) vevent.addPropertyWithValue('description', event.description)
    if (event.location) vevent.addPropertyWithValue('location', event.location)

    const dtstart = ICAL.Time.fromJSDate(event.start, !event.allDay)
    dtstart.timezone = event.timezone
    vevent.addPropertyWithValue('dtstart', dtstart)

    const dtend = ICAL.Time.fromJSDate(event.end, !event.allDay)
    dtend.timezone = event.timezone
    vevent.addPropertyWithValue('dtend', dtend)

    if (event.rrule) {
      vevent.addProperty(ICAL.Property.fromString(`RRULE:${event.rrule}`))
    }

    vevent.addPropertyWithValue('dtstamp', new ICAL.Time(new Date()))
    comp.addSubcomponent(vevent)

    return comp.toString()
  }
}
