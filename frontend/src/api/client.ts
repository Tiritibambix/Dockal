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

    // Log all responses
    this.api.interceptors.response.use(
      (response) => {
        console.log(`[API] Response ${response.status}: `, response.data)
        return response
      },
      (error) => {
        if (error.response) {
          console.log(`[API] Response error: `, error.response.data)
        } else {
          console.log(`[API] Response error: ${error.message}`)
        }
        return Promise.reject(error)
      }
    )
  }

  async login(username: string, password: string): Promise<{ token: string; username: string }> {
    console.log('[API] Login attempt')
    const response = await this.api.post('/auth/login', { username, password })
    return response.data
  }

  async getEvents(from: Date, to: Date): Promise<CalendarEvent[]> {
    const fromStr = from.toISOString().split('T')[0]
    const toStr = to.toISOString().split('T')[0]
    console.log(`[API] Getting events from ${fromStr} to ${toStr}`)
    const response = await this.api.get('/events', { params: { from: fromStr, to: toStr } })
    return response.data.events || []
  }

  async getEvent(uid: string): Promise<CalendarEvent | null> {
    const response = await this.api.get(`/events/${uid}`)
    return response.data.event || null
  }

  async createEvent(event: CalendarEvent): Promise<CalendarEvent> {
    const response = await this.api.post('/events', event)
    return response.data.event
  }

  async updateEvent(event: CalendarEvent): Promise<CalendarEvent> {
    const response = await this.api.put(`/events/${event.uid}`, event)
    return response.data.event
  }

  async deleteEvent(uid: string): Promise<void> {
    await this.api.delete(`/events/${uid}`)
  }

  async copyEvent(uid: string, payload: CopyEventPayload): Promise<void> {
    await this.api.post(`/events/${uid}/copy`, payload)
  }
}

export default APIClient
