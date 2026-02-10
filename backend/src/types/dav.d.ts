declare module 'dav' {
  export interface Account {
    username?: string
    password?: string
    serverUrl?: string
    // ...other runtime fields returned by dav
  }

  export interface CalendarObject {
    url: string
    data?: string
    etag?: string
  }

  export class Credentials {
    constructor(opts: { username: string; password: string })
  }

  export namespace transport {
    export class Basic {
      constructor(credentials: Credentials)
    }
  }

  export function createAccount(options: {
    server: string
    xhr?: any
    accountType?: string
    loadCollections?: boolean
    loadObjects?: boolean
  }): Promise<Account>

  export function calendarQuery(options: any): Promise<CalendarObject[]>
  export function fetchCalendarObjects(options: any): Promise<CalendarObject[]>
  export function createCalendarObject(options: any): Promise<void>
  export function updateCalendarObject(options: any): Promise<void>
  export function deleteCalendarObject(options: any): Promise<void>
}
