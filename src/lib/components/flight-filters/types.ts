import type { CalendarDate } from '@internationalized/date';

import type { OptionFilterId } from './definitions';

export type Route = {
  a: string;
  b: string;
};

export type OptionFilterOperator = 'is' | 'is not' | 'is any of' | 'is none of';

export type MultiOptionFilterOperator =
  | 'include'
  | 'exclude'
  | 'include any of'
  | 'include all of'
  | 'include exactly'
  | 'exclude if any of'
  | 'exclude if all'
  | 'exclude exactly';

export type OptionFilterState = {
  values: string[];
  operator: OptionFilterOperator | MultiOptionFilterOperator;
};

export type FlightFilters = {
  /** Only filters with values selected have an entry. */
  options: Partial<Record<OptionFilterId, OptionFilterState>>;
  fromDate: CalendarDate | undefined;
  toDate: CalendarDate | undefined;
  /** An airport or route pinned from the map details. */
  airportsEither: string[];
  routes: Route[];
};

/** The airports or route a map drilldown narrows the flight list to. */
export type TempFilters = {
  departureAirports: string[];
  arrivalAirports: string[];
  airportsEither: string[];
  routes: Route[];
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

export function routeMatchesEndpoints(
  fromId: string | number | null | undefined,
  toId: string | number | null | undefined,
  route: Route | null | undefined,
): boolean {
  if (fromId == null || toId == null || !route) return false;
  const from = fromId.toString();
  const to = toId.toString();
  return (
    (from === route.a && to === route.b) || (from === route.b && to === route.a)
  );
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
