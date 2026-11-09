import type { Airport } from '$lib/db/types';
import type { FlightData } from '$lib/utils';

type RecordHolder = {
  flight: FlightData;
  value: number;
};

const highestAndLowest = (
  flights: FlightData[],
  valueOf: (flight: FlightData) => number | null,
) => {
  let highest: RecordHolder | null = null;
  let lowest: RecordHolder | null = null;
  for (const flight of flights) {
    const value = valueOf(flight);
    if (value === null) continue;

    if (!highest || value > highest.value) highest = { flight, value };
    if (!lowest || value < lowest.value) lowest = { flight, value };
  }
  return { highest, lowest };
};

/**
 * The flights covering the most and least distance, in km. A flight back to
 * its own airport covers none, so it doesn't count as the shortest route.
 */
export const distanceRecords = (flights: FlightData[]) =>
  highestAndLowest(flights, (flight) => flight.distance || null);

/** The flights with the most and least time in the air, in seconds. */
export const durationRecords = (flights: FlightData[]) =>
  highestAndLowest(flights, (flight) => flight.duration);

/**
 * A flight's average ground speed in km/h, or null when it has no measured
 * one. Without both recorded times the duration is estimated from the
 * distance, so a speed derived from it would carry no information.
 */
export const averageSpeedKmh = (flight: FlightData): number | null =>
  flight.departure && flight.arrival && flight.distance && flight.duration
    ? (flight.distance * 3600) / flight.duration
    : null;

/** The flights with the highest and lowest measured average ground speed. */
export const speedRecords = (flights: FlightData[]) =>
  highestAndLowest(flights, averageSpeedKmh);

/** A time zone's UTC offset in hours at a moment, or null if unknowable. */
const offsetOf = (timeZone: string, at: Date): number | null => {
  try {
    const name = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset',
    })
      .formatToParts(at)
      .find((part) => part.type === 'timeZoneName')?.value;
    if (!name) return null;
    if (name === 'GMT') return 0;

    const match = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!match) return null;
    const sign = match[1] === '-' ? -1 : 1;
    return sign * (Number(match[2]) + Number(match[3] ?? 0) / 60);
  } catch {
    return null;
  }
};

/**
 * The flight spanning the most time zones, comparing the airports' UTC
 * offsets at departure so daylight saving counts. Both are read at the same
 * moment: reading the arrival later could straddle a changeover and count a
 * zone that no flight crossed. Flights that stay within one zone are no
 * record, so this is null when all of them do.
 */
export const timeZoneRecord = (flights: FlightData[]): RecordHolder | null => {
  let best: RecordHolder | null = null;
  for (const flight of flights) {
    const at = flight.departure ?? flight.date;
    if (!flight.from?.tz || !flight.to?.tz || !at) continue;

    const origin = offsetOf(flight.from.tz, at);
    const destination = offsetOf(flight.to.tz, at);
    if (origin === null || destination === null) continue;

    // Offsets run from -12 to +14, so the short way round may cross the
    // date line: Tokyo to Honolulu is 5 zones, not 19.
    const difference = Math.abs(destination - origin);
    const zones = Math.min(difference, 24 - difference);
    if (zones > (best?.value ?? 0)) best = { flight, value: zones };
  }
  return best;
};

/** The northernmost and southernmost airport any flight touched. */
export const latitudeRecords = (
  flights: FlightData[],
): { north: Airport | null; south: Airport | null } => {
  let north: Airport | null = null;
  let south: Airport | null = null;
  for (const flight of flights) {
    for (const airport of [flight.from, flight.to]) {
      if (!airport) continue;

      if (!north || airport.lat > north.lat) north = airport;
      if (!south || airport.lat < south.lat) south = airport;
    }
  }
  return { north, south };
};
