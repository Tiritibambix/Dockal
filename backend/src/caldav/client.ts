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
        loadObjects: false,
      })

      const calendars = this.account.calendars || []
      this.calendar = calendars[0]
      
      if (!this.calendar) {
        throw new Error('No calendar found')
      }
      
      console.log(`[CalDAV] Initialized with calendar: ${this.calendar.displayName} (${this.calendar.url})`)
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
      
      // Get list of calendar object URLs
      const objectUrls = await this.listCalendarObjectUrls()
      
      console.log(`[CalDAV] Found ${objectUrls.length} calendar objects`)

      for (let i = 0; i < objectUrls.length; i++) {
        const url = objectUrls[i]
        try {
          const icsData = await this.fetchCalendarObjectData(url)
          
          if (!icsData) {
            console.warn(`[CalDAV] Object ${i} (${url}) has no data`)
            continue
          }

          console.log(`[CalDAV] Parsing object ${i}`)
          
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
      
      const objectUrls = await this.listCalendarObjectUrls()

      for (const url of objectUrls) {
        try {
          const icsData = await this.fetchCalendarObjectData(url)
          
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

  private async listCalendarObjectUrls(): Promise<string[]> {
    try {
      const urls: string[] = []
      const calendarUrl = this.calendar.url
      
      console.log(`[CalDAV] Listing objects from ${calendarUrl}`)
      
      const response = await this.xhr.request({
        url: calendarUrl,
        method: 'PROPFIND',
        headers: {
          'Depth': '1',
          'Content-Type': 'application/xml',
        },
        data: `<?xml version="1.0" encoding="utf-8" ?>
<propfind xmlns="DAV:">
  <prop>
    <resourcetype/>
  </prop>
</propfind>`,
      })

      // Parse response to extract href values
      if (response.status === 207 && response.body) {
        const body = response.body
        const hrefRegex = /<href>(.*?)<\/href>/g
        let match
        while ((match = hrefRegex.exec(body)) !== null) {
          const href = match[1]
          // Skip the parent collection URL, only get .ics files
          if (href !== calendarUrl && href.endsWith('.ics')) {
            urls.push(href)
          }
        }
      }
      
      console.log(`[CalDAV] Found ${urls.length} .ics files`)
      return urls
    } catch (err) {
      console.error(`[CalDAV] Error listing calendar objects: ${String(err)}`)
      return []
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
