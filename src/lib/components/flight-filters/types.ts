import type { CalendarDate } from '@internationalized/date';

export type Route = {
  a: string;
  b: string;
};

export type FlightFilters = {
  departureAirports: string[];
  arrivalAirports: string[];
  airportsEither: string[];
  routes: Route[];
  fromDate: CalendarDate | undefined;
  toDate: CalendarDate | undefined;
  passengers: string[];
  airline: string[];
  aircraft: string[];
  aircraftRegs: string[];
};

export type TempFilters = {
  airportsEither: string[];
  routes: Route[];
};

export const defaultFilters: FlightFilters = {
  departureAirports: [],
  arrivalAirports: [],
  airportsEither: [],
  routes: [],
  fromDate: undefined,
  toDate: undefined,
  passengers: [],
  airline: [],
  aircraft: [],
  aircraftRegs: [],
};

export const defaultTempFilters: TempFilters = {
  airportsEither: [],
  routes: [],
};

export function normalizeRoute(idA: string, idB: string): Route {
  return idA <= idB ? { a: idA, b: idB } : { a: idB, b: idA };
}
