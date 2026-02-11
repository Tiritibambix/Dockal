import * as DAV from 'dav'
import ICAL from 'ical.js'
import { v4 as uuidv4 } from 'uuid'
import { CalendarEvent } from '../types.js'
import * as http from 'http'
import * as https from 'https'
import { URL } from 'url'

export class CalDAVClient {
  private account: any
  private calendar: any

  constructor(
    private radicaleUrl: string,
    private username: string,
    private password: string,
  ) {}

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

          if (i < 3) {
            console.log(`[CalDAV] Object ${i} data (first 300 chars): ${icsData.substring(0, 300)}`)
          }
          
          console.log(`[CalDAV] Parsing object ${i}`)
          
          // Parse the full ICS and extract events using regex as backup
          const vEventMatches = icsData.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || []
          console.log(`[CalDAV] Object ${i} contains ${vEventMatches.length} VEVENT(s) (regex match)`)

          // Also try ICAL.Component parsing
          try {
            const jcal = ICAL.parse(icsData)
            const comp = new ICAL.Component(jcal)
            
            // Try getFirstSubcomponent first
            let vevent = comp.getFirstSubcomponent('VEVENT')
            if (vevent) {
              const event = this.parseEvent(vevent)
              events.push(event)
              console.log(`[CalDAV] Parsed event via getFirstSubcomponent: ${event.title}`)
            }
          } catch (icalErr) {
            console.warn(`[CalDAV] ICAL.Component parsing failed: ${String(icalErr)}`)
            
            // Fallback: parse individual VEVENT blocks manually
            for (const vEventBlock of vEventMatches) {
              try {
                // Wrap individual VEVENT in VCALENDAR
                const wrappedICS = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Dockal//EN\n${vEventBlock}\nEND:VCALENDAR`
                const jcal = ICAL.parse(wrappedICS)
                const comp = new ICAL.Component(jcal)
                const vevent = comp.getFirstSubcomponent('VEVENT')
                
                if (vevent) {
                  const event = this.parseEvent(vevent)
                  events.push(event)
                  console.log(`[CalDAV] Parsed event via fallback: ${event.title}`)
                }
              } catch (fallbackErr) {
                console.warn(`[CalDAV] Fallback parsing failed: ${String(fallbackErr)}`)
              }
            }
          }
        } catch (parseErr) {
          console.warn(`[CalDAV] Failed to parse object ${i} (${url}): ${String(parseErr)}`)
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

  private buildAuthHeader(): string | undefined {
    if (!this.username && !this.password) return undefined
    return 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64')
  }

  private async httpRequest(urlStr: string, method = 'GET', body?: string, headers: Record<string, string> = {}): Promise<{ status: number; body: string }> {
    const url = new URL(urlStr)
    const isHttps = url.protocol === 'https:'
    const options: any = {
      method,
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + (url.search || ''),
      headers: {
        ...headers,
      },
    }
    const auth = this.buildAuthHeader()
    if (auth) options.headers['Authorization'] = auth

    return new Promise((resolve, reject) => {
      const req = (isHttps ? https : http).request(options, (res) => {
        let data = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => resolve({ status: res.statusCode || 0, body: data }))
      })
      req.on('error', reject)
      if (body) req.write(body)
      req.end()
    })
  }

  private async listCalendarObjectUrls(): Promise<string[]> {
    try {
      const urls: string[] = []
      const calendarUrl = this.calendar.url
      console.log(`[CalDAV] Listing objects from ${calendarUrl}`)

      const propfindBody = `<?xml version="1.0" encoding="utf-8" ?>
<propfind xmlns="DAV:">
  <prop>
    <resourcetype/>
  </prop>
</propfind>`

      const res = await this.httpRequest(calendarUrl, 'PROPFIND', propfindBody, { Depth: '1', 'Content-Type': 'application/xml' })
      if (res.status === 207 && res.body) {
        const hrefRegex = /<href>(.*?)<\/href>/g
        let match
        while ((match = hrefRegex.exec(res.body)) !== null) {
          const href = match[1]
          if (!href.endsWith('/') && href.endsWith('.ics')) {
            const full = href.startsWith('http') ? href : new URL(href, calendarUrl).toString()
            urls.push(full)
          }
        }
      } else {
        console.warn(`[CalDAV] PROPFIND returned ${res.status}`)
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
      const res = await this.httpRequest(url, 'GET', undefined, { Accept: 'text/calendar' })
      if (res.status === 200) return res.body
      console.warn(`[CalDAV] GET ${url} returned ${res.status}`)
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
