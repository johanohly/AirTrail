import type { TZDate } from '@date-fns/tz';

import type { FlightDatePrecision } from '$lib/db/types';

export const formatAsMonth = (date: TZDate) =>
  new Intl.DateTimeFormat(undefined, {
    timeZone: date.timeZone,
    month: 'short',
  }).format(date);
export const formatAsYear = (date: TZDate) =>
  new Intl.DateTimeFormat(undefined, {
    timeZone: date.timeZone,
    year: 'numeric',
  }).format(date);
export const formatAsDate = (
  date: TZDate,
  monthAsNumber = false,
  includeYear = false,
) =>
  new Intl.DateTimeFormat(undefined, {
    timeZone: date.timeZone,
    day: 'numeric',
    month: monthAsNumber ? 'numeric' : 'short',
    year: includeYear ? 'numeric' : undefined,
  }).format(date);
export const formatAsFlightDate = (
  date: TZDate,
  datePrecision: FlightDatePrecision,
  monthAsNumber = false,
  includeYear = false,
) => {
  switch (datePrecision) {
    case 'year':
      return formatAsYear(date);
    case 'month':
      return new Intl.DateTimeFormat(undefined, {
        timeZone: date.timeZone,
        month: monthAsNumber ? 'numeric' : 'short',
        year: includeYear ? 'numeric' : undefined,
      }).format(date);
    case 'day':
    default:
      return formatAsDate(date, monthAsNumber, includeYear);
  }
};
export const formatAsDateTime = (date: TZDate) =>
  new Intl.DateTimeFormat(undefined, {
    timeZone: date.timeZone,
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: 'numeric',
  }).format(date);
export const formatAsTime = (date: TZDate, overrideLocale?: string) =>
  new Intl.DateTimeFormat(overrideLocale, {
    timeZone: date.timeZone,
    hour: 'numeric',
    minute: 'numeric',
  }).format(date);
