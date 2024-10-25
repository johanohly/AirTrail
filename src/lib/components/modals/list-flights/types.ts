import type { TZDate } from '@date-fns/tz';

export type ToolbarFilters = {
  departureAirports: string[];
  arrivalAirports: string[];
  fromDate: TZDate | null;
  toDate: TZDate | null;
};
