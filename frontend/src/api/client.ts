import axios, { AxiosInstance } from 'axios'
import { CalendarEvent, CopyEventPayload } from '../types.js'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export class APIClient {
  private api: AxiosInstance

  constructor(token?: string) {
    this.api = axios.create({
      baseURL: API_BASE,
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    })
  }

  async login(username: string, password: string): Promise<{ token: string }> {
    const res = await this.api.post('/auth/login', { username, password })
    return res.data
  }

  async getEvents(from: Date, to: Date): Promise<CalendarEvent[]> {
    const res = await this.api.get('/events', {
      params: {
        from: from.toISOString().split('T')[0],
        to: to.toISOString().split('T')[0],
      },
    })
    return res.data.events
  }

  async createEvent(event: Omit<CalendarEvent, 'uid'>): Promise<CalendarEvent> {
    const res = await this.api.post('/events', event)
    return res.data
  }

  async updateEvent(event: CalendarEvent): Promise<CalendarEvent> {
    const res = await this.api.put(`/events/${event.uid}`, event)
    return res.data
  }

  async deleteEvent(uid: string): Promise<void> {
    await this.api.delete(`/events/${uid}`)
  }

  async copyEvent(uid: string, payload: CopyEventPayload): Promise<{ copiedEvents: CalendarEvent[] }> {
    const res = await this.api.post(`/events/${uid}/copy`, payload)
    return res.data
  }
}

export default APIClient
