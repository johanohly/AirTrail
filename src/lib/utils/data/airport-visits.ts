import { TZDate } from '@date-fns/tz';

import type { FlightDatePrecision } from '$lib/db/types';
import {
  formatAsFlightDate,
  getFlightDateRange,
  parseLocalizeISO,
} from '$lib/utils/datetime';

type AirportRef = { id: number; tz: string };

export type AirportVisitFlight = {
  from: AirportRef | null;
  to: AirportRef | null;
  datePrecision: FlightDatePrecision;
  duration: number | null;
  departure: TZDate | null;
  arrival: TZDate | null;
  departureScheduled: string | null;
  arrivalScheduled: string | null;
  takeoffScheduled: string | null;
  takeoffActual: string | null;
  landingScheduled: string | null;
  landingActual: string | null;
  raw: { date: string };
};

type VisitWindow = {
  start: TZDate;
  end: TZDate;
  precision: FlightDatePrecision;
};

const parseTime = (value: string | null, tz: string) =>
  value ? parseLocalizeISO(value, tz) : null;

const exactWindow = (date: TZDate): VisitWindow => ({
  start: date,
  end: date,
  precision: 'day',
});

const departureTime = (flight: AirportVisitFlight) => {
  const tz = flight.from?.tz ?? 'UTC';
  return (
    flight.departure ??
    parseTime(flight.takeoffActual, tz) ??
    parseTime(flight.departureScheduled, tz) ??
    parseTime(flight.takeoffScheduled, tz)
  );
};

const arrivalTime = (flight: AirportVisitFlight, departure: TZDate | null) => {
  const tz = flight.to?.tz ?? 'UTC';
  const recorded =
    flight.arrival ??
    parseTime(flight.landingActual, tz) ??
    parseTime(flight.arrivalScheduled, tz) ??
    parseTime(flight.landingScheduled, tz);

  if (recorded || !departure || flight.duration === null) return recorded;
  return new TZDate(departure.getTime() + flight.duration * 1_000, tz);
};

const visitWindow = (
  flight: AirportVisitFlight,
  direction: 'departure' | 'arrival',
): VisitWindow | null => {
  const departure = departureTime(flight);
  const exact =
    direction === 'departure' ? departure : arrivalTime(flight, departure);
  if (exact) return exactWindow(exact);
  if (direction === 'arrival') return null;

  const range = getFlightDateRange(
    flight.raw.date,
    flight.datePrecision,
    flight.from?.tz ?? 'UTC',
  );
  if (!range.start || !range.end) return null;
  return {
    start: range.start,
    end: range.end,
    precision: flight.datePrecision,
  };
};

type Visit = { label: string; time: number };

export const getAirportVisitSummary = (
  flights: AirportVisitFlight[],
  airportId: number,
  now: Date,
) => {
  let last: Visit | null = null;
  let next: Visit | null = null;

  for (const flight of flights) {
    const windows = [
      flight.from?.id === airportId ? visitWindow(flight, 'departure') : null,
      flight.to?.id === airportId ? visitWindow(flight, 'arrival') : null,
    ];

    for (const window of windows) {
      if (!window) continue;
      const label = formatAsFlightDate(
        window.start,
        window.precision,
        false,
        true,
      );

      if (window.end < now && (!last || window.end.getTime() > last.time)) {
        last = { label, time: window.end.getTime() };
      } else if (
        window.start > now &&
        (!next || window.start.getTime() < next.time)
      ) {
        next = { label, time: window.start.getTime() };
      }
    }
  }

  return { last: last?.label ?? null, next: next?.label ?? null };
};
