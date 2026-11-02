import type { CalendarDate } from '@internationalized/date';

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

export type LocationFilterValues = {
  departureAirports: string[];
  arrivalAirports: string[];
  airportsEither: string[];
  routes: Route[];
  departureCountries: string[];
  arrivalCountries: string[];
  departureContinents: string[];
  arrivalContinents: string[];
};

export type LocationFilterOperators = {
  departureAirportsOperator: OptionFilterOperator;
  arrivalAirportsOperator: OptionFilterOperator;
  routesOperator: OptionFilterOperator;
  departureCountriesOperator: OptionFilterOperator;
  arrivalCountriesOperator: OptionFilterOperator;
  departureContinentsOperator: OptionFilterOperator;
  arrivalContinentsOperator: OptionFilterOperator;
};

export type FlightFilters = LocationFilterValues &
  LocationFilterOperators & {
    years: string[];
    yearsOperator: OptionFilterOperator;
    fromDate: CalendarDate | undefined;
    toDate: CalendarDate | undefined;
    passengers: string[];
    passengersOperator: MultiOptionFilterOperator;
    airline: string[];
    airlineOperator: OptionFilterOperator;
    aircraft: string[];
    aircraftOperator: OptionFilterOperator;
    aircraftRegs: string[];
    aircraftRegsOperator: OptionFilterOperator;
    flightType: string[];
    flightTypeOperator: OptionFilterOperator;
    flightNumber: string[];
    flightNumberOperator: OptionFilterOperator;
    duration: string[];
    durationOperator: OptionFilterOperator;
    seatClass: string[];
    seatClassOperator: OptionFilterOperator;
    flightReason: string[];
    flightReasonOperator: OptionFilterOperator;
    seatType: string[];
    seatTypeOperator: OptionFilterOperator;
    seatNumber: string[];
    seatNumberOperator: OptionFilterOperator;
    months: string[];
    monthsOperator: OptionFilterOperator;
    days: string[];
    daysOperator: OptionFilterOperator;
  };

export type TempFilters = LocationFilterValues;

export type LocationFilters = LocationFilterValues &
  Partial<LocationFilterOperators>;

export const createDefaultTempFilters = (): TempFilters => ({
  departureAirports: [],
  arrivalAirports: [],
  airportsEither: [],
  routes: [],
  departureCountries: [],
  arrivalCountries: [],
  departureContinents: [],
  arrivalContinents: [],
});

export const defaultTempFilters: TempFilters = createDefaultTempFilters();

export function normalizeRoute(idA: string, idB: string): Route {
  return idA <= idB ? { a: idA, b: idB } : { a: idB, b: idA };
}

export const routeKey = (route: Route): string => `${route.a}|${route.b}`;

export function routeFromKey(key: string): Route {
  const sep = key.indexOf('|');
  return normalizeRoute(key.slice(0, sep), key.slice(sep + 1));
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
  tempFilters.departureCountries = [];
  tempFilters.arrivalCountries = [];
  tempFilters.departureContinents = [];
  tempFilters.arrivalContinents = [];
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
