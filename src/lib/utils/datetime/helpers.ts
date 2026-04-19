import { tz, TZDate } from '@date-fns/tz';
import { isBefore, parse } from 'date-fns';

import type { FlightDatePrecision } from '$lib/db/types';

import { parseLocalISO } from './parse';

export const nowIn = (tzId: string) => new TZDate(new Date(), tzId);
export const toUtc = (date: TZDate) => new TZDate(date, 'UTC');

export const isBeforeEpoch = (date: Date) =>
  isBefore(
    date,
    parse('1970-01-01', 'yyyy-MM-dd', new Date(), { in: tz('UTC') }),
  );

export const isSameLocalDay = (date1: TZDate, date2: TZDate) => {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  );
};

export const isUsingAmPm = () => {
  const test = new Date(Date.UTC(2025, 0, 1, 13, 0, 0)); // 13:00 UTC
  const formatted = test.toLocaleTimeString(undefined, { hour: 'numeric' });

  // Extract the first number from the string
  const match = formatted.match(/\d+/);
  const hour = match ? parseInt(match[0], 10) : NaN;

  // If the hour is <= 12, user is on 12h clock; if > 12, user is on 24h clock
  return hour <= 12;
};

/**
 * Returns the first day of the week as a JS getDay() value (0=Sun, 1=Mon, ..., 6=Sat),
 * based on the user's locale. Defaults to Monday (1) if unavailable.
 */
export const getStartOfWeekDay = () => {
  const localeIdentifier = navigator.language || 'en-US';
  const locale = new Intl.Locale(localeIdentifier);

  // weekInfo uses ISO day numbering (1=Mon, ..., 7=Sun)
  const isoDay =
    locale.getWeekInfo?.().firstDay ?? locale.weekInfo?.firstDay ?? 1;

  // Convert ISO (1-7, 7=Sun) to JS getDay() (0-6, 0=Sun)
  return isoDay % 7;
};

const pad = (value: number) => value.toString().padStart(2, '0');

const getLastDayOfMonth = (year: number, month: number) => {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
};

export const getFlightDateRange = (
  date: string | null,
  datePrecision: FlightDatePrecision,
  tzId: string,
) => {
  if (!date) {
    return { start: null, end: null };
  }

  const [yearPart, monthPart = '01', dayPart = '01'] = date.split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);

  if (!year || !month || !day) {
    return { start: null, end: null };
  }

  const startDate =
    datePrecision === 'year'
      ? `${year}-01-01`
      : datePrecision === 'month'
        ? `${year}-${pad(month)}-01`
        : `${year}-${pad(month)}-${pad(day)}`;

  const endDate =
    datePrecision === 'year'
      ? `${year}-12-31`
      : datePrecision === 'month'
        ? `${year}-${pad(month)}-${pad(getLastDayOfMonth(year, month))}`
        : `${year}-${pad(month)}-${pad(day)}`;

  return {
    start: parseLocalISO(`${startDate}T00:00`, tzId),
    end: parseLocalISO(`${endDate}T23:59:59.999`, tzId),
  };
};

export const supportsMonthBreakdown = (datePrecision: FlightDatePrecision) => {
  return datePrecision !== 'year';
};

export const supportsWeekdayBreakdown = (
  datePrecision: FlightDatePrecision,
) => {
  return datePrecision === 'day';
};
