import { FlightReasons, SeatClasses, SeatTypes } from '$lib/db/types';

import { MONTHS, SHORT_MONTHS } from '$lib/data/datetime';
import { estimateFlightDuration } from '$lib/utils/datetime/duration';
import { toTitleCase } from '$lib/utils';

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

/*
 * Menu layout, shared by the desktop filter menu and the mobile filter home
 * screen. "quickDate" is a menu entry, not a filter column.
 */
export const FILTER_GROUPS = [
  {
    label: 'Location',
    columns: ['departureAirports', 'arrivalAirports', 'routes'],
  },
  { label: 'Date & time', columns: ['quickDate', 'date', 'year', 'months', 'days'] },
  {
    label: 'Airline & aircraft',
    columns: ['airline', 'aircraft', 'aircraftRegs', 'flightNumber'],
  },
  { label: 'Flight', columns: ['flightType', 'duration'] },
  {
    label: 'Cabin & seat',
    columns: ['seatClass', 'flightReason', 'seatType', 'seatNumber'],
  },
  { label: 'People', columns: ['passengers'] },
] as const;
