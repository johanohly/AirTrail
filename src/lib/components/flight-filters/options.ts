import { COUNTRIES } from '$lib/data/countries';
import { MONTHS, SHORT_MONTHS } from '$lib/data/datetime';
import {
  ContinentMap,
  FlightReasons,
  SeatClasses,
  SeatTypes,
} from '$lib/db/types';
import { toTitleCase } from '$lib/utils';
import { estimateFlightDuration } from '$lib/utils/datetime/duration';

const COUNTRY_NAMES = new Map(
  COUNTRIES.map((country) => [country.alpha2, country.name]),
);

/* The country's display name, falling back to its alpha-2 code. */
export const countryName = (code: string): string =>
  COUNTRY_NAMES.get(code) ?? code;

export type FilterOptionSource = {
  value: string;
  label: string;
  shortLabel?: string;
  keywords?: string[];
};

/*
 * Duration buckets group flights by estimated flight time, derived from the
 * great-circle distance via estimateFlightDuration.
 */
export const SHORT_MAX_HOURS = 3;
export const MEDIUM_MAX_HOURS = 6;
export const LONG_MAX_HOURS = 12;

export type DurationBucket = 'short' | 'medium' | 'long' | 'ultralong';

export function durationBucketFor(
  km: number | null | undefined,
): DurationBucket | undefined {
  if (km == null) return undefined;
  const hours = estimateFlightDuration(km) / 3600;
  if (hours < SHORT_MAX_HOURS) return 'short';
  if (hours < MEDIUM_MAX_HOURS) return 'medium';
  if (hours < LONG_MAX_HOURS) return 'long';
  return 'ultralong';
}

export const flightTypeOptions: FilterOptionSource[] = [
  { value: 'domestic', label: 'Domestic' },
  { value: 'international', label: 'International' },
];

export const durationOptions: FilterOptionSource[] = [
  { value: 'short', label: 'Under 3 h' },
  { value: 'medium', label: '3–6 h' },
  { value: 'long', label: '6–12 h' },
  { value: 'ultralong', label: '12 h +' },
];

export const seatClassOptions: FilterOptionSource[] = SeatClasses.map(
  (value) => ({ value, label: toTitleCase(value) }),
);

export const flightReasonOptions: FilterOptionSource[] = FlightReasons.map(
  (value) => ({ value, label: toTitleCase(value) }),
);

export const seatTypeLabels: Record<string, string> = {
  window: 'Window',
  middle: 'Middle',
  aisle: 'Aisle',
  pilot: 'Pilot',
  copilot: 'Co-pilot',
  jumpseat: 'Jumpseat',
  other: 'Other',
};

export const seatTypeOptions: FilterOptionSource[] = SeatTypes.map((value) => ({
  value,
  label: seatTypeLabels[value] ?? toTitleCase(value),
}));

export const monthOptions: FilterOptionSource[] = MONTHS.map((name, index) => {
  const shortLabel = SHORT_MONTHS[index] ?? name;
  return {
    value: String(index),
    label: name,
    shortLabel,
    keywords: [name, shortLabel],
  };
});

export const dayOptions: FilterOptionSource[] = Array.from(
  { length: 31 },
  (_, i) => ({ value: String(i + 1), label: String(i + 1) }),
);

/* Continents of an airport, labeled with the app's continent names. */
export const continentOptions: FilterOptionSource[] = Object.entries(
  ContinentMap,
).map(([value, label]) => ({ value, label }));

/*
 * Case-insensitive substring match of a filter option against a search
 * query, over its label, value, short label, and keywords. An empty query
 * matches everything.
 */
export function optionMatchesQuery(
  option: {
    label: string;
    value: string;
    shortLabel?: string;
    keywords?: string[];
  },
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  if (option.label.toLowerCase().includes(needle)) return true;
  if (option.value.toLowerCase().includes(needle)) return true;
  if (option.shortLabel?.toLowerCase().includes(needle)) return true;
  return (option.keywords ?? []).some((keyword) =>
    keyword.toLowerCase().includes(needle),
  );
}

/*
 * Seat numbers order by row, then seat letter: 1A, 1B, 2C, 10A, 21F. Labels
 * without a numeric row sort after the parseable ones.
 */
export function compareSeatNumbers(a: string, b: string): number {
  const parse = (label: string) => /^(\d+)([A-Za-z]?)/.exec(label);
  const aMatch = parse(a);
  const bMatch = parse(b);
  if (aMatch && bMatch) {
    const row = Number(aMatch[1]) - Number(bMatch[1]);
    if (row !== 0) return row;
    return (aMatch[2] ?? '').localeCompare(bMatch[2] ?? '');
  }
  if (aMatch) return -1;
  if (bMatch) return 1;
  return a.localeCompare(b);
}

/*
 * Menu layout, shared by the desktop filter menu and the mobile filter home
 * screen. "quickDate" is a menu entry, not a filter column.
 */
export type FilterGroup = {
  label: string;
  columns: readonly string[];
};

export const FILTER_GROUPS: readonly FilterGroup[] = [
  {
    label: 'Location',
    columns: [
      'routes',
      'departureAirports',
      'arrivalAirports',
      'departureCountries',
      'arrivalCountries',
      'departureContinents',
      'arrivalContinents',
    ],
  },
  {
    label: 'Date & time',
    columns: ['quickDate', 'date', 'year', 'months', 'days'],
  },
  {
    label: 'Airline & aircraft',
    columns: ['airline', 'flightNumber', 'aircraft', 'aircraftRegs'],
  },
  { label: 'Flight', columns: ['flightType', 'duration'] },
  {
    label: 'Cabin & seat',
    columns: ['seatClass', 'flightReason', 'seatType', 'seatNumber'],
  },
  { label: 'People', columns: ['passengers'] },
];
