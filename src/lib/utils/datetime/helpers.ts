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

export const getStartOfWeekDay = () => {
  const locale = navigator.language || 'en-US';

  const formatter = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    timeZone: 'UTC',
  });

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.UTC(2021, 7, 1 + i)); // Aug 1, 2021 is a Sunday
    return formatter.format(date);
  });

  const firstDay = weekDays[0];

  if (/mon/i.test(firstDay)) return 'Monday';
  if (/sun/i.test(firstDay)) return 'Sunday';

  return 'Monday';
};
