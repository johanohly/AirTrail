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
};

export type LocationFilterOperators = {
  departureAirportsOperator: OptionFilterOperator;
  arrivalAirportsOperator: OptionFilterOperator;
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
    // Programmatic single-flight isolation (set from the map / list "show on
    // map" flows), not a user-facing filter-bar column.
    flightIds: string[];
  };

export type TempFilters = LocationFilterValues;

export type LocationFilters = LocationFilterValues &
  Partial<LocationFilterOperators>;

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
