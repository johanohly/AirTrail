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
  departureAirports: string[];
  arrivalAirports: string[];
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

export const createDefaultTempFilters = (): TempFilters => ({
  departureAirports: [],
  arrivalAirports: [],
  airportsEither: [],
  routes: [],
});

export const defaultTempFilters: TempFilters = createDefaultTempFilters();

export function normalizeRoute(idA: string, idB: string): Route {
  return idA <= idB ? { a: idA, b: idB } : { a: idB, b: idA };
}

export function hasTempFilters(tempFilters: TempFilters | undefined): boolean {
  return !!(
    tempFilters &&
    (tempFilters.departureAirports.length > 0 ||
      tempFilters.arrivalAirports.length > 0 ||
      tempFilters.airportsEither.length > 0 ||
      tempFilters.routes.length > 0)
  );
}

export function clearTempFilters(tempFilters: TempFilters): void {
  tempFilters.departureAirports = [];
  tempFilters.arrivalAirports = [];
  tempFilters.airportsEither = [];
  tempFilters.routes = [];
}

export function setTempDepartureAirport(
  tempFilters: TempFilters,
  airportId: string,
): void {
  clearTempFilters(tempFilters);
  tempFilters.departureAirports = [airportId];
}

export function setTempArrivalAirport(
  tempFilters: TempFilters,
  airportId: string,
): void {
  clearTempFilters(tempFilters);
  tempFilters.arrivalAirports = [airportId];
}

export function setTempAirportEither(
  tempFilters: TempFilters,
  airportId: string,
): void {
  clearTempFilters(tempFilters);
  tempFilters.airportsEither = [airportId];
}

export function setTempRoute(tempFilters: TempFilters, route: Route): void {
  clearTempFilters(tempFilters);
  tempFilters.routes = [route];
}
