import * as DAV from 'dav'
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
      const objectUrls = await this.listCalendarObjectUrls()
      
      console.log(`[CalDAV] Found ${objectUrls.length} calendar objects`)

      for (let i = 0; i < objectUrls.length; i++) {
        const url = objectUrls[i]
        try {
          const icsData = await this.fetchCalendarObjectData(url)
          
          if (!icsData) {
            continue
          }

          const event = this.parseICSText(icsData)
          if (event) {
            events.push(event)
            console.log(`[CalDAV] ✓ Parsed: ${event.title}`)
          }
        } catch (parseErr) {
          console.warn(`[CalDAV] Parse error object ${i}: ${String(parseErr)}`)
        }
      }

      console.log(`[CalDAV] Total: ${events.length} events`)
      return events
    } catch (err) {
      console.error(`[CalDAV] Error: ${String(err)}`)
      return []
    }
  }

  async getEventByUid(uid: string): Promise<CalendarEvent | null> {
    try {
      const objectUrls = await this.listCalendarObjectUrls()

      for (const url of objectUrls) {
        const icsData = await this.fetchCalendarObjectData(url)
        if (!icsData) continue

        const event = this.parseICSText(icsData)
        if (event && event.uid === uid) {
          return event
        }
      }
      return null
    } catch (err) {
      return null
    }
  }

  async createEvent(event: CalendarEvent): Promise<void> {
    try {
      console.log(`[CalDAV] Creating: ${event.uid}`)
      const ics = this.eventToICS(event)

      await DAV.createCalendarObject({
        calendar: this.calendar,
        filename: `${event.uid}.ics`,
        data: ics,
      })
      console.log(`[CalDAV] ✓ Created: ${event.uid}`)
    } catch (err) {
      throw new Error(`Failed to create event: ${String(err)}`)
    }
  }

  async updateEvent(event: CalendarEvent): Promise<void> {
    try {
      console.log(`[CalDAV] Updating: ${event.uid}`)
      const ics = this.eventToICS(event)

      await DAV.updateCalendarObject({
        calendarObject: {
          url: `${this.calendar.url}${event.uid}.ics`,
          data: ics,
        }
      })
      console.log(`[CalDAV] ✓ Updated: ${event.uid}`)
    } catch (err) {
      throw new Error(`Failed to update event: ${String(err)}`)
    }
  }

  async deleteEvent(uid: string): Promise<void> {
    try {
      console.log(`[CalDAV] Deleting: ${uid}`)
      
      await DAV.deleteCalendarObject({
        calendarObject: {
          url: `${this.calendar.url}${uid}.ics`,
        }
      })
      console.log(`[CalDAV] ✓ Deleted: ${uid}`)
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
      headers: { ...headers },
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
      }
      return urls
    } catch (err) {
      console.error(`[CalDAV] PROPFIND error: ${String(err)}`)
      return []
    }
  }

  private async fetchCalendarObjectData(url: string): Promise<string | null> {
    try {
      const res = await this.httpRequest(url, 'GET', undefined, { Accept: 'text/calendar' })
      return res.status === 200 ? res.body : null
    } catch (err) {
      return null
    }
  }

  private parseICSText(icsData: string): CalendarEvent | null {
    try {
      const lines = icsData.split(/\r?\n/)
      const props: { [key: string]: string } = {}
      
      let currentProp = ''
      for (const line of lines) {
        if (line.match(/^\s/) && currentProp) {
          props[currentProp] += line.trim()
        } else {
          const [key, ...valueParts] = line.split(':')
          if (key && valueParts.length > 0) {
            currentProp = key.split(';')[0].toUpperCase()
            props[currentProp] = valueParts.join(':').trim()
          }
        }
      }

      const uid = props['UID'] || `temp-${uuidv4()}`
      const title = props['SUMMARY'] || 'Untitled'
      const description = props['DESCRIPTION'] || undefined
      const location = props['LOCATION'] || undefined

      const dtStartStr = props['DTSTART']
      const dtEndStr = props['DTEND']

      if (!dtStartStr) {
        return null
      }

      const start = this.parseDate(dtStartStr)
      const end = this.parseDate(dtEndStr || dtStartStr)

      if (!start || !end) {
        return null
      }

      const allDay = /VALUE=DATE[^-]/.test(dtStartStr)

      return {
        uid,
        title,
        description,
        location,
        start,
        end,
        allDay,
        timezone: 'UTC',
      }
    } catch (err) {
      return null
    }
  }

  private parseDate(dateStr: string): Date | null {
    try {
      const cleanDate = dateStr.split(';').pop() || ''

      if (/^\d{8}$/.test(cleanDate)) {
        const year = parseInt(cleanDate.slice(0, 4), 10)
        const month = parseInt(cleanDate.slice(4, 6), 10) - 1
        const day = parseInt(cleanDate.slice(6, 8), 10)
        return new Date(year, month, day)
      }

      if (/^\d{8}T\d{6}Z?$/.test(cleanDate)) {
        const year = parseInt(cleanDate.slice(0, 4), 10)
        const month = parseInt(cleanDate.slice(4, 6), 10) - 1
        const day = parseInt(cleanDate.slice(6, 8), 10)
        const hour = parseInt(cleanDate.slice(9, 11), 10)
        const minute = parseInt(cleanDate.slice(11, 13), 10)
        const second = parseInt(cleanDate.slice(13, 15), 10)
        return new Date(year, month, day, hour, minute, second)
      }

      return new Date(cleanDate)
    } catch (err) {
      return null
    }
  }

  private eventToICS(event: CalendarEvent): string {
    const comp = {
      toString: () => {
        const lines: string[] = []
        lines.push('BEGIN:VCALENDAR')
        lines.push('VERSION:2.0')
        lines.push('PRODID:-//Dockal//Dockal//EN')
        lines.push('CALSCALE:GREGORIAN')
        
        lines.push('BEGIN:VEVENT')
        lines.push(`UID:${event.uid}`)
        lines.push(`SUMMARY:${this.escapeValue(event.title)}`)
        
        if (event.description) {
          lines.push(`DESCRIPTION:${this.escapeValue(event.description)}`)
        }
        if (event.location) {
          lines.push(`LOCATION:${this.escapeValue(event.location)}`)
        }
        
        lines.push(`DTSTART${event.allDay ? ';VALUE=DATE' : ''}:${this.formatDate(event.start, event.allDay)}`)
        lines.push(`DTEND${event.allDay ? ';VALUE=DATE' : ''}:${this.formatDate(event.end, event.allDay)}`)
        lines.push(`DTSTAMP:${this.formatDate(new Date(), false)}`)
        
        lines.push('END:VEVENT')
        lines.push('END:VCALENDAR')
        
        return lines.join('\r\n')
      }
    }
    
    return comp.toString()
  }

  private escapeValue(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n')
  }

  private formatDate(date: Date, allDay: boolean): string {
    const pad = (n: number) => String(n).padStart(2, '0')
    const year = date.getFullYear()
    const month = pad(date.getMonth() + 1)
    const day = pad(date.getDate())
    
    if (allDay) {
      return `${year}${month}${day}`
    }
    
    const hour = pad(date.getHours())
    const minute = pad(date.getMinutes())
    const second = pad(date.getSeconds())
    
    return `${year}${month}${day}T${hour}${minute}${second}Z`
  }
}
