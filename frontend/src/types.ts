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
  dates: string[]
}
