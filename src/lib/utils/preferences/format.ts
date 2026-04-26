import {
  cToF,
  hpaToInhg,
  kmToMiles,
  kmToNauticalMiles,
  ktToKmh,
  ktToMph,
  ktToMs,
} from './convert';

import type { Preferences } from '$lib/zod/user';

type DistancePrefs = Pick<Preferences, 'distanceUnit'>;
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
): string => `${formatDate(date, prefs, timeZone)} ${formatTime(date, prefs, timeZone)}`;

// ----- Week start -------------------------------------------------------

/**
 * Resolve `weekStartsOn` to a JS getDay() value (0=Sun, 1=Mon).
 * For 'auto', uses the browser's locale; falls back to Monday on the server.
 */
export const getWeekStartsOn = (prefs: WeekStartPrefs): 0 | 1 => {
  if (prefs.weekStartsOn === 'mon') return 1;
  if (prefs.weekStartsOn === 'sun') return 0;
  if (typeof navigator === 'undefined') return 1;
  const localeIdentifier = navigator.language || 'en-US';
  const locale = new Intl.Locale(localeIdentifier);
  const isoDay =
    locale.getWeekInfo?.().firstDay ?? locale.weekInfo?.firstDay ?? 1;
  // ISO uses 1=Mon..7=Sun, JS uses 0=Sun..6=Sat. Modulo converts.
  return (isoDay % 7) as 0 | 1;
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
