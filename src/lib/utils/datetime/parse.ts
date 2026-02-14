import { tz, TZDate } from '@date-fns/tz';
import { CalendarDateTime } from '@internationalized/date';
import { isValid, parse, parseISO } from 'date-fns';

import { formatAsTime } from './format';

export const parseLocalISO = (iso: string, tzId: string) =>
  parseISO(iso, { in: tz(tzId) });
export const parseLocalizeISO = (iso: string, toTz: string) =>
  new TZDate(parseISO(iso), toTz);

/**
 * Decompose a stored UTC ISO instant into a date anchor and a local time
 * string, suitable for populating form fields backed by a day picker + time
 * input.
 *
 * The returned `date` is a UTC-midnight ISO string representing the local
 * calendar day (not the original instant), because date-picker components
 * interpret the UTC date literally.
 *
 * @example
 * // A flight departing 2025-01-15 at 02:00 in Tokyo (UTC+9) is stored as
 * // 2025-01-14T17:00:00.000Z. Without this conversion the day picker would
 * // show January 14 instead of the correct January 15.
 * decomposeToLocal('2025-01-14T17:00:00.000Z', 'Asia/Tokyo', 'fr-FR')
 * // => { date: '2025-01-15T00:00:00.000Z', time: '02:00' }
 */
export const decomposeToLocal = (
  iso: string | null,
  tzId: string | null,
  locale: string,
): { date: string | null; time: string | null } => {
  if (!iso) return { date: null, time: null };

  if (!tzId) {
    const d = new Date(iso);
    return {
      date: new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
      ).toISOString(),
      time: null,
    };
  }

  const local = parseLocalizeISO(iso, tzId);
  return {
    date: new Date(
      Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()),
    ).toISOString(),
    time: formatAsTime(local, locale),
  };
};

export const parseLocal = (
  date: string,
  format: string,
  tzId: string,
): TZDate => parse(date, format, new Date(), { in: tz(tzId) });
export const parseLocalize = (date: string, format: string, toTz: string) =>
  new TZDate(parse(date, format, new Date()), toTz);

const timePartsRegex = /^(\d{1,2})(?::|\.|)(\d{2})(?:\s?(am|pm))?$/i;
export const mergeTimeWithDate = (
  dateString: string,
  time: string,
  tzId: string,
): TZDate => {
  const { year, month, day } = extractDateFromISO(dateString);
  const match = time.match(timePartsRegex);
  if (!match) {
    throw new Error('Invalid format');
  }
  const [, hourPart, minutePart, ampm] = match;
  if (!hourPart || !minutePart) {
    throw new Error('Invalid format');
  }

  let hours = +hourPart;
  const minutes = +minutePart;

  if (ampm) {
    if (ampm.toLowerCase() === 'pm' && hours < 12) {
      hours += 12; // Add 12 hours between 1 and 11 PM
    }
    if (ampm.toLowerCase() === 'am' && hours === 12) {
      hours = 0; // 12 AM is 0 hours from midnight
    }
  }

  const pad = (value: number) => value.toString().padStart(2, '0');
  const iso = `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}`;
  const result = parseLocalISO(iso, tzId);
  if (!isValid(result)) {
    throw new Error('Invalid format');
  }

  return result;
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

const ISO_DATE_REGEX = /(\d{4})-(\d{2})-(\d{2})/;
const extractDateFromISO = (iso: string) => {
  const match = iso.match(ISO_DATE_REGEX);
  if (!match) {
    throw new Error('Invalid ISO 8601 date time string: ' + iso);
  }

  const [, year, month, day] = match;
  if (!year || !month || !day) {
    throw new Error('Invalid ISO 8601 date time string: ' + iso);
  }

  return {
    year: parseNumber(year, 1, 9999),
    month: parseNumber(month, 1, 12),
    day: parseNumber(day, 1, 31),
  };
};

function parseNumber(value: string, min: number, max: number) {
  const val = Number(value);
  if (val < min || val > max) {
    throw new RangeError(`Value out of range: ${min} <= ${val} <= ${max}`);
  }

  return val;
}
