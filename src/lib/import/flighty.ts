import { tz, TZDate } from '@date-fns/tz';
import { addDays, differenceInSeconds, isBefore, parse } from 'date-fns';
import { z } from 'zod';

import { page } from '$app/state';
import type { PlatformOptions } from '$lib/components/modals/settings/pages/import-page';
import type { CreateFlight, Seat } from '$lib/db/types';
import { api } from '$lib/trpc';
import { parseCsv } from '$lib/utils';
import { toUtc } from '$lib/utils/datetime';

const nullTransformer = (v: string) => (v === '' ? null : v);

const FlightyFlight = z.object({
  from: z.string(),
  to: z.string(),
  gate_departure_actual: z.string().transform(nullTransformer),
  gate_departure_scheduled: z.string().transform(nullTransformer),
  gate_arrival_actual: z.string().transform(nullTransformer),
  gate_arrival_scheduled: z.string().transform(nullTransformer),
  airline: z.string().transform(nullTransformer),
  flight: z.string().transform(nullTransformer),
  seat_type: z.string().transform(nullTransformer),
  seat: z.string().transform(nullTransformer),
  cabin_class: z.string().transform(nullTransformer),
  flight_reason: z.string().transform(nullTransformer),
  tail_number: z.string().transform(nullTransformer),
  aircraft_type_name: z.string().transform(nullTransformer),
  notes: z.string().transform(nullTransformer),
});

/** Parses Flighty datetime (local airport time) and converts to UTC */
const parseFlightyDateTime = (
  actual: string | null,
  scheduled: string | null,
  airportTz: string,
): TZDate | null => {
  const dateTimeStr = actual || scheduled;
  if (!dateTimeStr) return null;

  const parsed = parse(dateTimeStr, "yyyy-MM-dd'T'HH:mm", new Date(), {
    in: tz(airportTz),
  });

  if (isNaN(parsed.getTime())) return null;

  return toUtc(parsed);
};

const mapSeatType = (seatType: string | null): Seat['seat'] => {
  if (!seatType) return null;
  const normalized = seatType.toLowerCase().trim();
  switch (normalized) {
    case 'window':
      return 'window';
    case 'aisle':
      return 'aisle';
    case 'middle':
      return 'middle';
    case 'captain':
      return 'pilot';
    case 'pilot':
      return 'copilot';
    case 'jumpseat':
      return 'jumpseat';
    default:
      return 'other';
  }
};

const mapSeatClass = (seatClass: string | null): Seat['seatClass'] => {
  if (!seatClass) return null;
  const normalized = seatClass.toLowerCase().trim();
  switch (normalized) {
    case 'economy':
      return 'economy';
    case 'economy+':
    case 'premium economy':
    case 'premium':
      return 'economy+';
    case 'business':
      return 'business';
    case 'first':
    case 'first class':
      return 'first';
    case 'private':
      return 'private';
    default:
      return 'economy';
  }
};

const mapFlightReason = (
  reason: string | null,
): CreateFlight['flightReason'] => {
  if (!reason) return null;
  const normalized = reason.toLowerCase().trim();
  switch (normalized) {
    case 'leisure':
    case 'personal':
    case 'vacation':
      return 'leisure';
    case 'business':
    case 'work':
      return 'business';
    case 'crew':
      return 'crew';
    default:
      return 'other';
  }
};

export const processFlightyFile = async (
  input: string,
  options: PlatformOptions,
) => {
  const userId = page.data.user?.id;
  if (!userId) {
    throw new Error('User not found');
  }

  const [data, error] = parseCsv(input, FlightyFlight);
  if (data.length === 0 || error) {
    return {
      flights: [],
      unknownAirports: {},
      unknownAirlines: {},
    };
  }

  const flights: CreateFlight[] = [];
  const unknownAirports: Record<string, number[]> = {};
  const unknownAirlines: Record<string, number[]> = {};

  for (const row of data) {
    const mappedFrom = options.airportMapping?.[row.from];
    const mappedTo = options.airportMapping?.[row.to];
    const from = mappedFrom ?? (await api.airport.getFromIata.query(row.from));
    const to = mappedTo ?? (await api.airport.getFromIata.query(row.to));

    const departure = parseFlightyDateTime(
      row.gate_departure_actual,
      row.gate_departure_scheduled,
      from?.tz ?? 'UTC',
    );
    let arrival = parseFlightyDateTime(
      row.gate_arrival_actual,
      row.gate_arrival_scheduled,
      to?.tz ?? 'UTC',
    );

    if (!departure || !arrival) {
      console.warn('Skipping flight due to missing datetime:', row);
      continue;
    }

    if (isBefore(arrival, departure)) {
      arrival = addDays(arrival, 1, { in: tz('UTC') });
    }

    const duration = differenceInSeconds(arrival, departure);

    let airline = null;
    let airlineIcao: string | undefined;
    if (row.airline) {
      airlineIcao = row.airline.trim().toUpperCase();
      const mappedAirline = options.airlineMapping?.[airlineIcao];
      airline = mappedAirline || null;
      if (!airline) {
        airline = (await api.airline.getByIcao.query(airlineIcao)) ?? null;
      }
      if (!airline) {
        airline = (await api.airline.getByIata.query(airlineIcao)) ?? null;
      }
    }

    const aircraft = row.aircraft_type_name
      ? await api.aircraft.getByName.query(row.aircraft_type_name)
      : null;

    const flightNumber =
      row.airline && row.flight
        ? `${row.airline}${row.flight}`.substring(0, 10)
        : null;

    const date = departure.toISOString().split('T')[0]!;

    const flightIndex = flights.length;

    if (!from) {
      if (!unknownAirports[row.from]) unknownAirports[row.from] = [];
      unknownAirports[row.from]!.push(flightIndex);
    }
    if (!to) {
      if (!unknownAirports[row.to]) unknownAirports[row.to] = [];
      unknownAirports[row.to]!.push(flightIndex);
    }
    if (!airline && airlineIcao) {
      if (!unknownAirlines[airlineIcao]) unknownAirlines[airlineIcao] = [];
      unknownAirlines[airlineIcao]!.push(flightIndex);
    }

    flights.push({
      date,
      from: from || null,
      to: to || null,
      departure: departure.toISOString(),
      arrival: arrival.toISOString(),
      duration,
      flightNumber,
      note: row.notes,
      airline,
      aircraft,
      aircraftReg: row.tail_number ? row.tail_number.substring(0, 10) : null,
      flightReason: mapFlightReason(row.flight_reason),
      seats: [
        {
          userId,
          seat: mapSeatType(row.seat_type),
          seatClass: mapSeatClass(row.cabin_class),
          seatNumber: row.seat ? row.seat.substring(0, 5) : null,
          guestName: null,
        },
      ],
    });
  }

  return {
    flights,
    unknownAirports,
    unknownAirlines,
  };
};
