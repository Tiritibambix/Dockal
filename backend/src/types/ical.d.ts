declare module 'ical.js' {
  export class Component {
    constructor(data: any);
    parse(icsString: string): Component;
    getFirstSubcomponent(name?: string): Component | null;
    getFirstPropertyValue(name: string): any;
    getFirstProperty(name: string): Property | null;
    addPropertyWithValue(name: string, value: any): Property;
    addSubcomponent(component: Component): Component;
    addProperty(property: Property): Property;
    toJCal(): any;
  }

  export class Event {
    constructor(data: any);
  }

  export class Property {
    constructor(data: any);
  }

  export class Time {
    constructor(data: any);
    static fromJSDate(date: Date, useUTC?: boolean): Time;
  }

  export function parse(icsString: string): Component;
}
