import * as DAV from 'dav'
import ICAL from 'ical.js'
import { CalendarEvent } from '../types.js'

export class CalDAVClient {
  private account: any
  private calendarUrl: string

  constructor(
    private radicaleUrl: string,
    private username: string,
    private password: string,
  ) {
    this.calendarUrl = `${radicaleUrl}/${username}/calendar.ics/`
  }

  async initialize() {
    try {
      console.log('[CalDAV] Initializing client')
      const creds = new DAV.Credentials({ username: this.username, password: this.password })
      const xhr = new DAV.transport.Basic(creds)

      this.account = await DAV.createAccount({
        server: this.radicaleUrl,
        xhr,
        accountType: 'caldav',
        loadCollections: true,
        loadObjects: false,
      })
      console.log('[CalDAV] Initialized successfully')
    } catch (err) {
      throw new Error(`CalDAV initialization failed: ${String(err)}`)
    }
  }

  async listCalendars() {
    try {
      console.log('[CalDAV] Listing calendars')
      const calendars = await DAV.fetchCalendarObjects({
        account: this.account,
        url: this.calendarUrl,
      })
      return calendars
    } catch (err) {
      throw new Error(`Failed to list calendars: ${String(err)}`)
    }
  }

  async getEvents(from: Date, to: Date): Promise<CalendarEvent[]> {
    try {
      console.log(`[CalDAV] Getting events from ${from} to ${to}`)
      
      const results = await DAV.fetchCalendarObjects({
        account: this.account,
        url: this.calendarUrl,
      })

      const events: CalendarEvent[] = []

      for (const obj of results) {
        try {
          const icsData = obj.data
          const jcal = ICAL.parse(icsData)
          const comp = new ICAL.Component(jcal)
          const vevent = comp.getFirstSubcomponent('VEVENT')

          if (vevent) {
            events.push(this.parseEvent(vevent))
          }
        } catch (parseErr) {
          console.warn(`[CalDAV] Failed to parse event: ${String(parseErr)}`)
          continue
        }
      }

      console.log(`[CalDAV] Found ${events.length} events`)
      return events
    } catch (err) {
      throw new Error(`Failed to fetch events: ${String(err)}`)
    }
  }

  async getEventByUid(uid: string): Promise<CalendarEvent | null> {
    try {
      console.log(`[CalDAV] Getting event by UID: ${uid}`)
      const objs = await DAV.fetchCalendarObjects({
        account: this.account,
        url: this.calendarUrl,
      })

      for (const obj of objs) {
        try {
          const jcal = ICAL.parse(obj.data)
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
      throw new Error(`Failed to fetch event: ${String(err)}`)
    }
  }

  async createEvent(event: CalendarEvent): Promise<void> {
    try {
      console.log(`[CalDAV] Creating event: ${event.uid}`)
      const ics = this.eventToICS(event)
      await DAV.createCalendarObject({
        account: this.account,
        url: `${this.calendarUrl}${event.uid}.ics`,
        data: ics,
        contentType: 'text/calendar',
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
        account: this.account,
        url: `${this.calendarUrl}${event.uid}.ics`,
        data: ics,
        contentType: 'text/calendar',
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
        account: this.account,
        url: `${this.calendarUrl}${uid}.ics`,
      })
      console.log(`[CalDAV] Event deleted: ${uid}`)
    } catch (err) {
      throw new Error(`Failed to delete event: ${String(err)}`)
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
