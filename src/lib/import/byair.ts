import { tz, TZDate } from '@date-fns/tz';
import { addDays, differenceInSeconds, isBefore } from 'date-fns';
import { z } from 'zod';

import { page } from '$app/state';
import type { CreateFlight, FlightPassenger } from '$lib/db/types';
import type { PlatformOptions } from '$lib/import/model';
import { parseCsv } from '$lib/utils';
import { getAirlineByIata, getAirlineByIcao } from '$lib/utils/data/airlines';
import { getAirportByIata } from '$lib/utils/data/airports/cache';
import { parseLocalISO, toUtc } from '$lib/utils/datetime';

const nullTransformer = (v: string) => (v === '' ? null : v);

const ByAirFields = z.object({
  flight_code: z.string().transform(nullTransformer),
  departure_airport_code: z.string(),
  arrival_airport_code: z.string(),
  booking_code: z.string().transform(nullTransformer),
  seat_number: z.string().transform(nullTransformer),
  seat_type: z.string().transform(nullTransformer),
  seat_class: z.string().transform(nullTransformer),
  purpose: z.string().transform(nullTransformer),
  notes: z.string().transform(nullTransformer),
  ownership: z.string().transform(nullTransformer),
  byair_flight_id: z.string().transform(nullTransformer),
  byair_codeshare_id: z.string().transform(nullTransformer),
});

const LegacyByAirFlight = ByAirFields.extend({
  flight_date: z.string(),
  departure_time: z.string().transform(nullTransformer),
  arrival_time: z.string().transform(nullTransformer),
}).transform((row) => ({
  ...row,
  date: row.flight_date,
  departure: row.departure_time
    ? `${row.flight_date}T${row.departure_time}:00`
    : null,
  arrival: row.arrival_time
    ? `${row.flight_date}T${row.arrival_time}:00`
    : null,
  departureScheduled: null,
  arrivalScheduled: null,
  arrivalHasDate: false,
  durationFromScheduled: false,
}));

const toLocalISO = (value: string) => value.trim().replace(' ', 'T');

const ByAirDatetime = z
  .string()
  .transform((value) => (value.trim() === '' ? null : toLocalISO(value)));

const CurrentByAirFlight = ByAirFields.extend({
  scheduled_departure: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}/)
    .transform(toLocalISO),
  scheduled_arrival: ByAirDatetime,
  actual_departure: ByAirDatetime,
  actual_arrival: ByAirDatetime,
}).transform((row) => ({
  ...row,
  date: row.scheduled_departure.slice(0, 10),
  departure: row.actual_departure ?? row.scheduled_departure,
  arrival: row.actual_arrival ?? row.scheduled_arrival,
  departureScheduled: row.scheduled_departure,
  arrivalScheduled: row.scheduled_arrival,
  arrivalHasDate: true,
  // Mixing an actual departure with a scheduled arrival can give a duration
  // of minutes, so only a full actual pair beats the schedule.
  durationFromScheduled: !(row.actual_departure && row.actual_arrival),
}));

const ByAirFlight = z.union([CurrentByAirFlight, LegacyByAirFlight]);

const parseByAirTime = (
  value: string | null,
  airportTz: string,
): TZDate | null => {
  if (!value) return null;
  const parsed = parseLocalISO(value, airportTz);
  if (isNaN(parsed.getTime())) return null;
  return toUtc(parsed);
};

const mapSeatType = (seatType: string | null): FlightPassenger['seat'] => {
  if (!seatType) return null;
  const normalized = seatType.toLowerCase().trim();
  switch (normalized) {
    case 'window':
      return 'window';
    case 'aisle':
      return 'aisle';
    case 'middle':
      return 'middle';
    default:
      return 'other';
  }
};

const mapSeatTypeFromClass = (
  seatClass: string | null,
): FlightPassenger['seat'] => {
  if (!seatClass) return null;
  const normalized = seatClass.toLowerCase().trim();
  switch (normalized) {
    case 'cockpit':
      return 'pilot';
    case 'jumpseat':
      return 'jumpseat';
    default:
      return null;
  }
};

const mapSeatClass = (
  seatClass: string | null,
): FlightPassenger['seatClass'] => {
  if (!seatClass) return null;
  const normalized = seatClass.toLowerCase().trim();
  switch (normalized) {
    case 'economy':
      return 'economy';
    case 'economy_plus':
    case 'premium_economy':
      return 'economy+';
    case 'business':
      return 'business';
    case 'first_class':
      return 'first';
    case 'private':
      return 'private';
    case 'cockpit':
    case 'jumpseat':
      return null;
    default:
      return null;
  }
};

const mapFlightReason = (
  purpose: string | null,
): FlightPassenger['flightReason'] => {
  if (!purpose) return null;
  const normalized = purpose.toLowerCase().trim();
  switch (normalized) {
    case 'leisure':
      return 'leisure';
    case 'business':
      return 'business';
    default:
      return null;
  }
};

export const processByAirFile = async (
  input: string,
  options: PlatformOptions,
) => {
  const userId = page.data.user?.id;
  if (!userId) {
    throw new Error('User not found');
  }

  const { rows: data, skipped } = parseCsv(input, ByAirFlight);
  if (data.length === 0) {
    return {
      flights: [],
      unknowns: { airports: {}, airlines: {}, aircraft: {} },
      exportedUsers: [],
      skippedRows: skipped.length,
    };
  }

  const flights: CreateFlight[] = [];
  const unknownAirports: Record<string, number[]> = {};
  const unknownAirlines: Record<string, number[]> = {};

  for (const row of data) {
    if (options.filterOwner && row.ownership !== 'mine') {
      continue;
    }

    const fromCode = row.departure_airport_code.trim();
    const toCode = row.arrival_airport_code.trim();

    const mappedFrom = options.airportMapping?.[fromCode];
    const mappedTo = options.airportMapping?.[toCode];
    const from = mappedFrom ?? (await getAirportByIata(fromCode));
    const to = mappedTo ?? (await getAirportByIata(toCode));

    const fromTz = from?.tz ?? 'UTC';
    const toTz = to?.tz ?? 'UTC';
    const departure = parseByAirTime(row.departure, fromTz);
    let arrival = parseByAirTime(row.arrival, toTz);
    const departureScheduled = parseByAirTime(row.departureScheduled, fromTz);
    let arrivalScheduled = parseByAirTime(row.arrivalScheduled, toTz);

    if (!row.arrivalHasDate) {
      while (departure && arrival && isBefore(arrival, departure)) {
        arrival = addDays(arrival, 1, { in: tz('UTC') });
      }
    } else {
      // The server rejects an arrival before its departure. A delayed actual
      // departure paired with the scheduled arrival is the common cause.
      if (departure && arrival && isBefore(arrival, departure)) {
        arrival = null;
      }
      if (
        departureScheduled &&
        arrivalScheduled &&
        isBefore(arrivalScheduled, departureScheduled)
      ) {
        arrivalScheduled = null;
      }
    }

    const [durationFrom, durationTo] = row.durationFromScheduled
      ? [departureScheduled, arrivalScheduled]
      : [departure, arrival];
    const duration =
      durationFrom && durationTo
        ? differenceInSeconds(durationTo, durationFrom)
        : null;

    // Extract airline code from flight code (e.g., "SK501" -> "SK", "SL*1508" -> "SL")
    let airline = null;
    let airlineCode: string | undefined;
    let flightNumber = row.flight_code;

    if (options.airlineFromFlightNumber && row.flight_code) {
      const match = row.flight_code.match(/^([A-Z]{2,3})\*?\d/);
      if (match?.[1]) {
        airlineCode = match[1];
        const mappedAirline = options.airlineMapping?.[airlineCode];
        airline = mappedAirline || null;
        if (!airline) {
          airline = (await getAirlineByIata(airlineCode)) ?? null;
        }
        if (!airline) {
          airline = (await getAirlineByIcao(airlineCode)) ?? null;
        }
      }
    }

    // Clean up flight number: remove asterisk from codeshare notation (e.g., "SL*1508" -> "SL1508")
    if (flightNumber) {
      flightNumber = flightNumber.replace('*', '');
    }

    const flightIndex = flights.length;

    if (!from) {
      if (!unknownAirports[fromCode]) unknownAirports[fromCode] = [];
      unknownAirports[fromCode]!.push(flightIndex);
    }
    if (!to) {
      if (!unknownAirports[toCode]) unknownAirports[toCode] = [];
      unknownAirports[toCode]!.push(flightIndex);
    }
    if (!airline && airlineCode) {
      if (!unknownAirlines[airlineCode]) unknownAirlines[airlineCode] = [];
      unknownAirlines[airlineCode]!.push(flightIndex);
    }

    const buildNotes = (): string | null => {
      const parts: string[] = [];
      if (row.notes) {
        parts.push(row.notes);
      }
      if (row.booking_code) {
        parts.push(`Booking: ${row.booking_code}`);
      }
      return parts.length > 0 ? parts.join(' | ') : null;
    };

    flights.push({
      date: row.date,
      from: from || null,
      to: to || null,
      departure: departure ? departure.toISOString() : null,
      arrival: arrival ? arrival.toISOString() : null,
      departureScheduled: departureScheduled?.toISOString() ?? null,
      arrivalScheduled: arrivalScheduled?.toISOString() ?? null,
      takeoffScheduled: null,
      takeoffActual: null,
      landingScheduled: null,
      landingActual: null,
      datePrecision: 'day',
      departureTerminal: null,
      departureGate: null,
      arrivalTerminal: null,
      arrivalGate: null,
      duration,
      flightNumber: flightNumber ? flightNumber.substring(0, 10) : null,
      note: buildNotes(),
      airline,
      aircraft: null,
      aircraftReg: null,
      passengers: [
        {
          userId,
          seat:
            mapSeatTypeFromClass(row.seat_class) ?? mapSeatType(row.seat_type),
          seatClass: mapSeatClass(row.seat_class),
          seatNumber: row.seat_number ? row.seat_number.substring(0, 5) : null,
          guestName: null,
          flightReason: mapFlightReason(row.purpose),
        },
      ],
    });
  }

  return {
    flights,
    unknowns: {
      airports: unknownAirports,
      airlines: unknownAirlines,
      aircraft: {},
    },
    exportedUsers: [],
    skippedRows: skipped.length,
  };
};
