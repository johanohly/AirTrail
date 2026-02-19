import { tz, TZDate } from '@date-fns/tz';
import { addDays, differenceInSeconds, isBefore } from 'date-fns';
import { z } from 'zod';

import { page } from '$app/state';
import type { PlatformOptions } from '$lib/components/modals/settings/pages/import-page';
import type { CreateFlight, Seat } from '$lib/db/types';
import { parseCsv } from '$lib/utils';
import { getAircraftByName } from '$lib/utils/data/aircraft';
import { getAirlineByIata, getAirlineByIcao } from '$lib/utils/data/airlines';
import { getAirportByIata } from '$lib/utils/data/airports/cache';
import { parseLocalISO, toUtc } from '$lib/utils/datetime';

const nullTransformer = (v: string) => (v === '' ? null : v);

const FlightyFlight = z.object({
  from: z.string(),
  to: z.string(),
  gate_departure_actual: z.string().transform(nullTransformer),
  gate_departure_scheduled: z.string().transform(nullTransformer),
  gate_arrival_actual: z.string().transform(nullTransformer),
  gate_arrival_scheduled: z.string().transform(nullTransformer),
  take_off_scheduled: z.string().transform(nullTransformer),
  take_off_actual: z.string().transform(nullTransformer),
  landing_scheduled: z.string().transform(nullTransformer),
  landing_actual: z.string().transform(nullTransformer),
  dep_terminal: z.string().transform(nullTransformer),
  dep_gate: z.string().transform(nullTransformer),
  arr_terminal: z.string().transform(nullTransformer),
  arr_gate: z.string().transform(nullTransformer),
  pnr: z.string().transform(nullTransformer),
  canceled: z.string().transform(nullTransformer),
  diverted_to: z.string().transform(nullTransformer),
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

const parseFlightyTime = (
  value: string | null,
  airportTz: string,
): TZDate | null => {
  if (!value) return null;
  const parsed = parseLocalISO(value, airportTz);
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

const buildNotes = (row: z.infer<typeof FlightyFlight>): string | null => {
  const parts: string[] = [];

  // Add original notes first
  if (row.notes) {
    parts.push(row.notes);
  }

  // Add PNR
  if (row.pnr) {
    parts.push(`PNR: ${row.pnr}`);
  }

  // Add canceled/diverted status
  if (row.canceled === 'true') {
    parts.push('CANCELED');
  }
  if (row.diverted_to) {
    parts.push(`Diverted to: ${row.diverted_to}`);
  }

  return parts.length > 0 ? parts.join(' | ') : null;
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
    const from = mappedFrom ?? (await getAirportByIata(row.from));
    const to = mappedTo ?? (await getAirportByIata(row.to));

    const departureScheduled = parseFlightyTime(
      row.gate_departure_scheduled,
      from?.tz ?? 'UTC',
    );
    const departureActual = parseFlightyTime(
      row.gate_departure_actual,
      from?.tz ?? 'UTC',
    );
    const arrivalScheduled = parseFlightyTime(
      row.gate_arrival_scheduled,
      to?.tz ?? 'UTC',
    );
    const arrivalActual = parseFlightyTime(
      row.gate_arrival_actual,
      to?.tz ?? 'UTC',
    );
    const takeoffScheduled = parseFlightyTime(
      row.take_off_scheduled,
      from?.tz ?? 'UTC',
    );
    const takeoffActual = parseFlightyTime(
      row.take_off_actual,
      from?.tz ?? 'UTC',
    );
    const landingScheduled = parseFlightyTime(
      row.landing_scheduled,
      to?.tz ?? 'UTC',
    );
    const landingActual = parseFlightyTime(row.landing_actual, to?.tz ?? 'UTC');

    const departure = departureActual ?? departureScheduled;
    let arrival = arrivalActual ?? arrivalScheduled;

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
        airline = (await getAirlineByIcao(airlineIcao)) ?? null;
      }
      if (!airline) {
        airline = (await getAirlineByIata(airlineIcao)) ?? null;
      }
    }

    const aircraft = row.aircraft_type_name
      ? await getAircraftByName(row.aircraft_type_name)
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
      departureScheduled: departureScheduled
        ? departureScheduled.toISOString()
        : null,
      arrivalScheduled: arrivalScheduled
        ? arrivalScheduled.toISOString()
        : null,
      takeoffScheduled: takeoffScheduled
        ? takeoffScheduled.toISOString()
        : null,
      takeoffActual: takeoffActual ? takeoffActual.toISOString() : null,
      landingScheduled: landingScheduled
        ? landingScheduled.toISOString()
        : null,
      landingActual: landingActual ? landingActual.toISOString() : null,
      departureTerminal: row.dep_terminal,
      departureGate: row.dep_gate,
      arrivalTerminal: row.arr_terminal,
      arrivalGate: row.arr_gate,
      duration,
      flightNumber,
      note: buildNotes(row),
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
