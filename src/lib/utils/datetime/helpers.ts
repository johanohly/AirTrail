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
  return new Date().toLocaleTimeString().match(/am|pm/i) !== null;
};

export const getStartOfWeekDay = () => {
  const locale = navigator.language || 'en-US';

  const formatter = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' });

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.UTC(2021, 7, 1 + i)); // Aug 1, 2021 is a Sunday
    return formatter.format(date);
  });

  const firstDay = weekDays[0];

  if (/mon/i.test(firstDay)) return 'Monday';
  if (/sun/i.test(firstDay)) return 'Sunday';

  return 'Monday';
}
