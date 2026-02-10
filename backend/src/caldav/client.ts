// Note: xmldom package has been replaced with @xmldom/xmldom for better security and maintenance
import * as DAV from 'dav'
import ICAL from 'ical.js'
import { CalendarEvent } from '../types.js'

const {
  createAccount,
  calendarQuery,
  fetchCalendarObjects,
  createCalendarObject,
  updateCalendarObject,
  deleteCalendarObject,
} = DAV

export class CalDAVClient {
  private account: any
  private calendarUrl: string

  constructor(
    private radicaleUrl: string,
    private username: string,
    private password: string,
  ) {
    this.calendarUrl = `${radicaleUrl}/user/${username}/calendar.ics/`
  }

  async initialize() {
    try {
      this.account = await createAccount({
        serverUrl: this.radicaleUrl,
        username: this.username,
        password: this.password,
        authType: 'basic',
      })
    } catch (err) {
      throw new Error(`CalDAV initialization failed: ${err}`)
    }
  }

  async listCalendars() {
    try {
      const calendars = await fetchCalendarObjects({
        account: this.account,
        url: this.calendarUrl,
      })
      return calendars
    } catch (err) {
      throw new Error(`Failed to list calendars: ${err}`)
    }
  }

  async getEvents(from: Date, to: Date): Promise<CalendarEvent[]> {
    try {
      const filters = [
        ['VEVENT', [['DTSTART', { '&': 'T' }, from.toISOString()]]]
      ]

      const results = await calendarQuery({
        account: this.account,
        url: this.calendarUrl,
        filters,
        depth: 1,
      })

      const events: CalendarEvent[] = []

      for (const obj of results) {
        const icsData = obj.data
        const jcal = ICAL.parse(icsData)
        const comp = new ICAL.Component(jcal)
        const vevent = comp.getFirstSubcomponent('VEVENT')

        if (vevent) {
          events.push(this.parseEvent(vevent))
        }
      }

      return events
    } catch (err) {
      throw new Error(`Failed to fetch events: ${err}`)
    }
  }

  async getEventByUid(uid: string): Promise<CalendarEvent | null> {
    try {
      const objs = await fetchCalendarObjects({
        account: this.account,
        url: this.calendarUrl,
      })

      for (const obj of objs) {
        const jcal = ICAL.parse(obj.data)
        const comp = new ICAL.Component(jcal)
        const vevent = comp.getFirstSubcomponent('VEVENT')
        if (vevent && vevent.getFirstPropertyValue('uid') === uid) {
          return this.parseEvent(vevent)
        }
      }
      return null
    } catch (err) {
      throw new Error(`Failed to fetch event: ${err}`)
    }
  }

  async createEvent(event: CalendarEvent): Promise<void> {
    try {
      const ics = this.eventToICS(event)
      await createCalendarObject({
        account: this.account,
        url: `${this.calendarUrl}${event.uid}.ics`,
        data: ics,
        contentType: 'text/calendar',
      })
    } catch (err) {
      throw new Error(`Failed to create event: ${err}`)
    }
  }

  async updateEvent(event: CalendarEvent): Promise<void> {
    try {
      const ics = this.eventToICS(event)
      await updateCalendarObject({
        account: this.account,
        url: `${this.calendarUrl}${event.uid}.ics`,
        data: ics,
        contentType: 'text/calendar',
      })
    } catch (err) {
      throw new Error(`Failed to update event: ${err}`)
    }
  }

  async deleteEvent(uid: string): Promise<void> {
    try {
      await deleteCalendarObject({
        account: this.account,
        url: `${this.calendarUrl}${uid}.ics`,
      })
    } catch (err) {
      throw new Error(`Failed to delete event: ${err}`)
    }
  }

  private parseEvent(vevent: ICAL.Component): CalendarEvent {
    const uid = vevent.getFirstPropertyValue('uid') as string
    const summary = vevent.getFirstPropertyValue('summary') as string || ''
    const description = vevent.getFirstPropertyValue('description') as string || undefined
    const location = vevent.getFirstPropertyValue('location') as string || undefined
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
      vevent.getFirstProperty('rrule') || vevent.addProperty(ICAL.Property.fromString(`RRULE:${event.rrule}`))
    }

    vevent.addPropertyWithValue('dtstamp', new ICAL.Time(new Date()))
    comp.addSubcomponent(vevent)

    return comp.toString()
  }
}
