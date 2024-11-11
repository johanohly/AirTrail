import type { CalendarDate } from '@internationalized/date';

export type FlightFilters = {
  departureAirports: string[];
  arrivalAirports: string[];
  fromDate: CalendarDate | undefined;
  toDate: CalendarDate | undefined;
};

export const defaultFilters: FlightFilters = {
  departureAirports: [],
  arrivalAirports: [],
  fromDate: undefined,
  toDate: undefined,
};
