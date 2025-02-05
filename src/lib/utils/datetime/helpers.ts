import { tz, TZDate } from '@date-fns/tz';
import { type DateArg, isBefore, parse } from 'date-fns';

export const nowIn = (tzId: string) => new TZDate(new Date(), tzId);
export const toUtc = (date: TZDate) => new TZDate(date, 'UTC');

export const isBeforeEpoch = (date: Date) =>
  isBefore(
    date,
    parse('1970-01-01', 'yyyy-MM-dd', new Date(), { in: tz('UTC') }),
  );

export const isUsingAmPm = () => {
  return new Date().toLocaleTimeString().match(/am|pm/i) !== null;
};
