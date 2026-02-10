declare module '@xmldom/xmldom' {
  export interface Account {
    username: string
    password: string
    serverUrl: string
  }

  export interface Calendar {
    url: string
    ctag?: string
    displayName?: string
  }

  export interface CalendarObject {
    url: string
    data?: string
    etag?: string
  }

  export interface TimeObj {
    timezone?: string
    toJSDate(): Date
    toICALString(): string
    isDate: boolean
  }

  export class Component {
    constructor(data: any)
    getFirstSubcomponent(name: string): Component | null
    getFirstPropertyValue(name: string): any
    addPropertyWithValue(name: string, value: any): void
    addSubcomponent(comp: Component): void
    getFirstProperty(name: string): any
    addProperty(prop: Property): void
    toString(): string
  }

  export class Property {
    static fromString(str: string): Property
  }

  export class Time {
    static fromJSDate(date: Date, includeTime?: boolean): TimeObj
    timezone?: string
    toJSDate(): Date
    toICALString(): string
    isDate: boolean
  }

  export function parse(icsString: string): any[]
  export function createAccount(options: {
    serverUrl: string
    username: string
    password: string
    authType?: 'basic' | 'digest'
  }): Promise<Account>
  export function calendarQuery(options: any): Promise<CalendarObject[]>
  export function fetchCalendarObjects(options: any): Promise<CalendarObject[]>
  export function createCalendarObject(options: any): Promise<void>
  export function updateCalendarObject(options: any): Promise<void>
  export function deleteCalendarObject(options: any): Promise<void>
}
