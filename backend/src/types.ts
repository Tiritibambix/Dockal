export interface CalendarEvent {
  uid: string
  title: string
  description?: string
  location?: string
  start: Date
  end: Date
  allDay: boolean
  timezone: string
  rrule?: string
}

export interface CopyEventPayload {
  dates: string[] // ISO date strings: YYYY-MM-DD
}

export interface CopyEventResult {
  copiedEvents: CalendarEvent[]
  sourceUid: string
}

export interface AuthPayload {
  username: string
  password: string
}

export interface JWTPayload {
  username: string
  iat: number
}
