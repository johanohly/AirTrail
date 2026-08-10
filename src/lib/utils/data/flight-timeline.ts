import { TZDate } from '@date-fns/tz';
import { isBefore } from 'date-fns';

import type { Flight, FlightDatePrecision } from '$lib/db/types';
import { getFlightDateRange, parseLocalizeISO } from '$lib/utils/datetime';

export type FlightTimeline = {
  precision: FlightDatePrecision;
  dateStart: TZDate | null;
  dateEnd: TZDate | null;
  recordedDeparture: TZDate | null;
  recordedArrival: TZDate | null;
  effectiveDeparture: TZDate | null;
  effectiveArrival: TZDate | null;
};

export type FlightTimelineWindow = {
  start: TZDate;
  end: TZDate;
  precision: FlightDatePrecision;
};

const parseTime = (value: string | null, timezone: string) =>
  value ? parseLocalizeISO(value, timezone) : null;

export const resolveFlightTimeline = (flight: Flight): FlightTimeline => {
  const fromTimezone = flight.from?.tz ?? 'UTC';
  const toTimezone = flight.to?.tz ?? 'UTC';
  const { start: dateStart, end: dateEnd } = getFlightDateRange(
    flight.date,
    flight.datePrecision,
    fromTimezone,
  );
  const hasExactDate = flight.datePrecision === 'day';
  const recordedDeparture = hasExactDate
    ? parseTime(flight.departure, fromTimezone)
    : null;
  const recordedArrival = hasExactDate
    ? parseTime(flight.arrival, toTimezone)
    : null;
  const effectiveDeparture =
    recordedDeparture ??
    parseTime(flight.takeoffActual, fromTimezone) ??
    parseTime(flight.departureScheduled, fromTimezone) ??
    parseTime(flight.takeoffScheduled, fromTimezone);
  const recordedOrScheduledArrival =
    recordedArrival ??
    parseTime(flight.landingActual, toTimezone) ??
    parseTime(flight.arrivalScheduled, toTimezone) ??
    parseTime(flight.landingScheduled, toTimezone);
  const effectiveArrival =
    recordedOrScheduledArrival ??
    (effectiveDeparture && flight.duration !== null
      ? new TZDate(
          effectiveDeparture.getTime() + flight.duration * 1_000,
          toTimezone,
        )
      : null);

  return {
    precision: flight.datePrecision,
    dateStart,
    dateEnd,
    recordedDeparture,
    recordedArrival,
    effectiveDeparture,
    effectiveArrival,
  };
};

export const isCompletedFlight = (
  flight: Flight,
  now: Date = new Date(),
): boolean => {
  const timeline = resolveFlightTimeline(flight);
  const fallbackDate =
    timeline.precision === 'day'
      ? timeline.dateStart
      : (timeline.dateEnd ?? timeline.dateStart);
  const comparisonDate =
    timeline.effectiveArrival ?? timeline.effectiveDeparture ?? fallbackDate;

  return comparisonDate ? isBefore(comparisonDate, now) : true;
};

export const getFlightTimelineWindow = (
  timeline: FlightTimeline,
  direction: 'departure' | 'arrival',
): FlightTimelineWindow | null => {
  const exact =
    direction === 'departure'
      ? timeline.effectiveDeparture
      : timeline.effectiveArrival;
  if (exact) return { start: exact, end: exact, precision: 'day' };
  if (direction === 'arrival' || !timeline.dateStart || !timeline.dateEnd) {
    return null;
  }
  return {
    start: timeline.dateStart,
    end: timeline.dateEnd,
    precision: timeline.precision,
  };
};
