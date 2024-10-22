import { tz, TZDate } from '@date-fns/tz';
import { isBefore, parse, parseISO } from 'date-fns';

export const parseLocalISO = (iso: string, tzId: string) =>
  parseISO(iso, { in: tz(tzId) });
export const parseLocalizeISO = (iso: string, toTz: string) =>
  new TZDate(parseISO(iso), toTz);

export const parseLocal = (
  date: string,
  format: string,
  tzId: string,
): TZDate => parse(date, format, new Date(), { in: tz(tzId) });
export const parseLocalize = (date: string, format: string, toTz: string) =>
  new TZDate(parse(date, format, new Date()), toTz);

export const nowIn = (tzId: string) => new TZDate(new Date(), tzId);
export const toUtc = (date: TZDate) => new TZDate(date, 'UTC');

export const isBeforeEpoch = (date: TZDate) =>
  isBefore(
    date,
    parse('1970-01-01', 'yyyy-MM-dd', new Date(), { in: tz('UTC') }),
  );

export const isUsingAmPm = () => {
  return new Date().toLocaleTimeString().match(/am|pm/i) !== null;
};
