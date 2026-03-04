import { tz, TZDate } from '@date-fns/tz';
import { isBefore, parse } from 'date-fns';

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
