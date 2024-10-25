import type { CalendarDate } from '@internationalized/date';

export type ToolbarFilters = {
  departureAirports: string[];
  arrivalAirports: string[];
  fromDate: CalendarDate | undefined;
  toDate: CalendarDate | undefined;
};
