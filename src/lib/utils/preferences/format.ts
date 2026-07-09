import {
  cToF,
  feetToMeters,
  hpaToInhg,
  kmToMiles,
  kmToNauticalMiles,
  ktToKmh,
  ktToMph,
  ktToMs,
} from './convert';

import type { Preferences } from '$lib/zod/user';

type DistancePrefs = Pick<Preferences, 'distanceUnit'>;
type AltitudePrefs = Pick<Preferences, 'distanceUnit'>;
type WindPrefs = Pick<Preferences, 'windSpeedUnit'>;
type TempPrefs = Pick<Preferences, 'temperatureUnit'>;
type PressurePrefs = Pick<Preferences, 'pressureUnit'>;
type TimePrefs = Pick<Preferences, 'timeFormat'>;
type DatePrefs = Pick<Preferences, 'dateFormat'>;
type WeekStartPrefs = Pick<Preferences, 'weekStartsOn'>;
type FlightTimePrefs = Pick<Preferences, 'flightTimeDisplay'>;

// ----- Distance ---------------------------------------------------------

export const convertDistance = (km: number, prefs: DistancePrefs): number => {
  switch (prefs.distanceUnit) {
    case 'mi':
      return kmToMiles(km);
    case 'nm':
      return kmToNauticalMiles(km);
    case 'km':
    default:
      return km;
  }
};

export const distanceUnitLabel = (prefs: DistancePrefs): string => {
  switch (prefs.distanceUnit) {
    case 'mi':
      return 'mi';
    case 'nm':
      return 'nm';
    case 'km':
    default:
      return 'km';
  }
};

export const formatDistance = (
  km: number,
  prefs: DistancePrefs,
  opts: Intl.NumberFormatOptions = {},
): string => {
  const value = convertDistance(km, prefs);
  // 'nautical-mile' isn't in the Intl unit list, format manually.
  if (prefs.distanceUnit === 'nm') {
    const num = new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 0,
      ...opts,
    }).format(value);
    return `${num} nm`;
  }
  return new Intl.NumberFormat(undefined, {
    style: 'unit',
    unit: prefs.distanceUnit === 'mi' ? 'mile' : 'kilometer',
    unitDisplay: 'short',
    maximumFractionDigits: 0,
    ...opts,
  }).format(value);
};

// ----- Altitude ---------------------------------------------------------

export const convertAltitude = (feet: number, prefs: AltitudePrefs): number =>
  prefs.distanceUnit === 'km' ? feetToMeters(feet) : feet;

export const altitudeUnitLabel = (prefs: AltitudePrefs): 'm' | 'ft' =>
  prefs.distanceUnit === 'km' ? 'm' : 'ft';

// ----- Wind speed -------------------------------------------------------

export const convertWindSpeed = (kt: number, prefs: WindPrefs): number => {
  switch (prefs.windSpeedUnit) {
    case 'mph':
      return ktToMph(kt);
    case 'kmh':
      return ktToKmh(kt);
    case 'ms':
      return ktToMs(kt);
    case 'kt':
    default:
      return kt;
  }
};

export const windSpeedUnitLabel = (prefs: WindPrefs): string => {
  switch (prefs.windSpeedUnit) {
    case 'mph':
      return 'mph';
    case 'kmh':
      return 'km/h';
    case 'ms':
      return 'm/s';
    case 'kt':
    default:
      return 'kt';
  }
};

export const formatWindSpeed = (kt: number, prefs: WindPrefs): string => {
  const v = convertWindSpeed(kt, prefs);
  return `${Math.round(v)} ${windSpeedUnitLabel(prefs)}`;
};

// ----- Temperature ------------------------------------------------------

export const convertTemperature = (c: number, prefs: TempPrefs): number =>
  prefs.temperatureUnit === 'f' ? cToF(c) : c;

export const temperatureUnitLabel = (prefs: TempPrefs): string =>
  prefs.temperatureUnit === 'f' ? '°F' : '°C';

export const formatTemperature = (c: number, prefs: TempPrefs): string => {
  return `${Math.round(convertTemperature(c, prefs))}${temperatureUnitLabel(prefs)}`;
};

// ----- Pressure ---------------------------------------------------------

export const convertPressure = (hpa: number, prefs: PressurePrefs): number =>
  prefs.pressureUnit === 'inhg' ? hpaToInhg(hpa) : hpa;

export const pressureUnitLabel = (prefs: PressurePrefs): string =>
  prefs.pressureUnit === 'inhg' ? 'inHg' : 'hPa';

export const formatPressure = (hpa: number, prefs: PressurePrefs): string => {
  const v = convertPressure(hpa, prefs);
  if (prefs.pressureUnit === 'inhg') return `${v.toFixed(2)} inHg`;
  return `${Math.round(v)} hPa`;
};

// ----- Time / Date ------------------------------------------------------

const localeForDateFormat = (
  format: Preferences['dateFormat'],
): string | undefined => {
  switch (format) {
    case 'iso':
      return 'en-CA'; // YYYY-MM-DD with numeric short
    case 'us':
      return 'en-US';
    case 'eu':
      return 'en-GB';
    case 'auto':
    default:
      return undefined;
  }
};

export const formatTime = (
  date: Date,
  prefs: TimePrefs,
  timeZone?: string,
): string => {
  const opts: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: 'numeric',
  };
  if (timeZone) opts.timeZone = timeZone;
  if (prefs.timeFormat === '12h') opts.hour12 = true;
  else if (prefs.timeFormat === '24h') opts.hourCycle = 'h23';
  return new Intl.DateTimeFormat(undefined, opts).format(date);
};

export const formatDate = (
  date: Date,
  prefs: DatePrefs,
  timeZone?: string,
): string => {
  const locale = localeForDateFormat(prefs.dateFormat);
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).format(date);
};

export const formatDateTime = (
  date: Date,
  prefs: DatePrefs & TimePrefs,
  timeZone?: string,
): string =>
  `${formatDate(date, prefs, timeZone)} ${formatTime(date, prefs, timeZone)}`;

// ----- Week start -------------------------------------------------------

export type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Resolve `weekStartsOn` to a JS getDay() value (0=Sun..6=Sat).
 * For 'auto', uses the browser's locale; falls back to Monday on the server.
 */
export const getWeekStartsOn = (prefs: WeekStartPrefs): WeekDay => {
  if (prefs.weekStartsOn === 'mon') return 1;
  if (prefs.weekStartsOn === 'sun') return 0;
  if (typeof navigator === 'undefined') return 1;
  const localeIdentifier = navigator.language || 'en-US';
  const locale = new Intl.Locale(localeIdentifier);
  const isoDay =
    locale.getWeekInfo?.().firstDay ?? locale.weekInfo?.firstDay ?? 1;
  // ISO uses 1=Mon..7=Sun, JS uses 0=Sun..6=Sat. Modulo converts.
  return (isoDay % 7) as WeekDay;
};

// ----- Flight time display ----------------------------------------------

interface FlightTzShape {
  from?: { tz: string } | null;
  to?: { tz: string } | null;
}

/**
 * Resolve which timezone to render a flight endpoint in, based on the user's
 * preference. Falls back through: requested endpoint → other endpoint → UTC.
 */
export const resolveFlightTimeZone = (
  flight: FlightTzShape,
  endpoint: 'departure' | 'arrival',
  prefs: FlightTimePrefs,
): string => {
  if (prefs.flightTimeDisplay === 'utc') return 'UTC';
  if (prefs.flightTimeDisplay === 'system') {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  const primary = endpoint === 'departure' ? flight.from?.tz : flight.to?.tz;
  return primary ?? flight.from?.tz ?? flight.to?.tz ?? 'UTC';
};

/**
 * Resolve the timezone the flight form should interpret its date/time inputs
 * in, given the user's `flightTimeDisplay` preference. Falls back to the
 * provided airport tz, then to UTC.
 */
export const resolveFlightEditTimeZone = (
  prefs: FlightTimePrefs,
  airportTz: string | null | undefined,
): string => {
  if (prefs.flightTimeDisplay === 'utc') return 'UTC';
  if (prefs.flightTimeDisplay === 'system') {
    return typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'UTC';
  }
  return airportTz ?? 'UTC';
};

/**
 * Pick an Intl locale appropriate for rendering 12h/24h time controls based on
 * the user's `timeFormat` preference. `auto` falls back to the browser locale.
 */
export const resolveTimeLocale = (prefs: TimePrefs): string => {
  if (prefs.timeFormat === '12h') return 'en-US';
  if (prefs.timeFormat === '24h') return 'fr-FR';
  return typeof navigator !== 'undefined' && navigator.language
    ? navigator.language
    : 'en-US';
};

/**
 * Pick an Intl locale that produces the user's preferred date segment order
 * (DD/MM, MM/DD, YYYY-MM-DD). `auto` falls back to the browser locale.
 */
export const resolveDateLocale = (prefs: DatePrefs): string => {
  const locale = localeForDateFormat(prefs.dateFormat);
  if (locale) return locale;
  return typeof navigator !== 'undefined' && navigator.language
    ? navigator.language
    : 'en-US';
};

/**
 * Re-express a (YYYY-MM-DD, HH:MM) pair from one timezone to another while
 * preserving the absolute moment they describe. Used by the flight form to
 * convert between airport-local storage and the user's chosen display tz.
 */
export const reinterpretLocalDateTime = (
  date: string,
  time: string,
  fromTz: string,
  toTz: string,
): { date: string; time: string } => {
  if (fromTz === toTz) return { date, time };
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  if ([y, m, d, h, min].some((v) => Number.isNaN(v))) {
    return { date, time };
  }
  // Find the UTC instant whose local representation in `fromTz` equals the
  // given fields. We use Intl to invert the tz offset rather than constructing
  // a TZDate (which would couple this helper to date-fns/tz).
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: fromTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const target = Date.UTC(y, m - 1, d, h, min);
  // Two-pass to account for DST: first guess, then refine by the offset error.
  const offsetAt = (utc: number): number => {
    const parts = fmt.formatToParts(new Date(utc));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asUtc = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour') % 24,
      get('minute'),
      get('second'),
    );
    return asUtc - utc;
  };
  let utc = target - offsetAt(target);
  utc = target - offsetAt(utc);
  const out = new Intl.DateTimeFormat('en-CA', {
    timeZone: toTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    // `hourCycle: 'h23'` is authoritative and guarantees 00–23 (so we never
    // see Safari's stray '24' for midnight). `hour12: false` is kept as a
    // belt-and-braces fallback for any runtime that doesn't honor hourCycle;
    // when both are set, hourCycle wins per the Intl spec.
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(new Date(utc));
  const p = (t: string) => out.find((part) => part.type === t)?.value ?? '';
  return {
    date: `${p('year')}-${p('month')}-${p('day')}`,
    time: `${p('hour')}:${p('minute')}`,
  };
};

/**
 * Translate an airport-local (storedDate, storedTime) pair into editTz-local
 * values suitable for display. The date is returned as a "YYYY-MM-DDT00:00:00.000Z"
 * ISO string for compatibility with the form state shape; the time is "HH:MM".
 * Inputs pass through unchanged when conversion is unnecessary or impossible.
 */
export const pairToDisplay = (
  storedDate: string | null,
  storedTime: string | null,
  airportTz: string,
  editTz: string,
): { date: string | null; time: string | null } => {
  if (!storedDate || !storedTime || editTz === airportTz) {
    return { date: storedDate, time: storedTime };
  }
  const r = reinterpretLocalDateTime(
    storedDate.slice(0, 10),
    storedTime,
    airportTz,
    editTz,
  );
  return { date: `${r.date}T00:00:00.000Z`, time: r.time };
};

/**
 * Translate an editTz-local (date, time) pair into airport-local storage
 * values. Callers must provide an anchor date — a time alone is ambiguous
 * once you account for cross-midnight tz shifts and DST.
 */
export const pairToStorage = (
  anchorDate: string,
  time: string,
  editTz: string,
  airportTz: string,
): { date: string; time: string } => {
  if (editTz === airportTz) {
    // Matches the flight-form storage shape: the date is stored as the day at
    // UTC midnight and the time as a separate "HH:MM" string, so any non-
    // midnight time component on `anchorDate` is intentionally discarded.
    return { date: `${anchorDate.slice(0, 10)}T00:00:00.000Z`, time };
  }
  const r = reinterpretLocalDateTime(
    anchorDate.slice(0, 10),
    time,
    editTz,
    airportTz,
  );
  return { date: `${r.date}T00:00:00.000Z`, time: r.time };
};
