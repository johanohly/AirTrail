import { tz, TZDate } from '@date-fns/tz';
import { isBefore, parse, parseISO } from 'date-fns';
import { CalendarDateTime, type Mutable } from '@internationalized/date';

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

// Modified version of the parseAbsolute function from @internationalized/date
// to create a CalendarDateTime object from an ISO 8601 date time string
const ABSOLUTE_RE =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}))?(?::(\d{2}))?(?::(\d{2}))?(\.\d+)?(?:(?:([+-]\d{2})(?::?(\d{2}))?)|Z)$/;

export const dateValueFromISO = (iso: string) => {
  const m = iso.match(ABSOLUTE_RE);
  if (!m) {
    throw new Error('Invalid ISO 8601 date time string: ' + iso);
  }

  const [, year, month, day, hour, minute, second, ms] = m;
  if (!year || !month || !day) {
    throw new Error('Invalid ISO 8601 date time string: ' + iso);
  }

  return new CalendarDateTime(
    parseNumber(year, 1, 9999),
    parseNumber(month, 1, 12),
    parseNumber(day, 1, 31),
    hour ? parseNumber(hour, 0, 23) : 0,
    minute ? parseNumber(minute, 0, 59) : 0,
    second ? parseNumber(second, 0, 59) : 0,
    ms ? parseNumber(ms, 0, Infinity) * 1000 : 0,
  );
};

function parseNumber(value: string, min: number, max: number) {
  const val = Number(value);
  if (val < min || val > max) {
    throw new RangeError(`Value out of range: ${min} <= ${val} <= ${max}`);
  }

  return val;
}
