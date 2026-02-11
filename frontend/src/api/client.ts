import axios, { AxiosInstance } from 'axios'
import { CalendarEvent, CopyEventPayload } from '../types'

const API_BASE = '/api' // Utilise le proxy nginx

export class APIClient {
  private api: AxiosInstance

  constructor(token?: string) {
    this.api = axios.create({
      baseURL: API_BASE,
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    })

    // Log all requests
    this.api.interceptors.request.use(
      (config) => {
        console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`, config.data || '')
        return config
      },
      (err) => {
        console.error('[API] Request error:', err)
        return Promise.reject(err)
      }
    )

    // Log all responses
    this.api.interceptors.response.use(
      (response) => {
        console.log(`[API] Response ${response.status}:`, response.data)
        return response
      },
      (err) => {
        console.error('[API] Response error:', err.response?.data || err.message)
        return Promise.reject(err)
      }
    )
  }

  async login(username: string, password: string): Promise<{ token: string }> {
    console.log('[API] Login attempt')
    const res = await this.api.post('/auth/login', { username, password })
    return res.data
  }

  async getEvents(from: Date, to: Date): Promise<CalendarEvent[]> {
    const fromStr = from.toISOString().split('T')[0]
    const toStr = to.toISOString().split('T')[0]
    console.log(`[API] Getting events from ${fromStr} to ${toStr}`)
    const res = await this.api.get('/events', {
      params: { from: fromStr, to: toStr },
    })
    return res.data.events || []
  }

  async createEvent(event: Omit<CalendarEvent, 'uid'>): Promise<CalendarEvent> {
    console.log('[API] Creating event')
    const res = await this.api.post('/events', event)
    return res.data
  }

  async updateEvent(event: CalendarEvent): Promise<CalendarEvent> {
    console.log(`[API] Updating event ${event.uid}`)
    const res = await this.api.put(`/events/${event.uid}`, event)
    return res.data
  }

  async deleteEvent(uid: string): Promise<void> {
    console.log(`[API] Deleting event ${uid}`)
    await this.api.delete(`/events/${uid}`)
  }

  async copyEvent(uid: string, payload: CopyEventPayload): Promise<{ copiedEvents: CalendarEvent[] }> {
    console.log(`[API] Copying event ${uid}`)
    const res = await this.api.post(`/events/${uid}/copy`, payload)
    return res.data
  }
}

export default APIClient
