import { differenceInSeconds } from 'date-fns';
import { z } from 'zod';

import { page } from '$app/state';
import type { PlatformOptions } from '$lib/components/modals/settings/pages/import-page';
import type { CreateFlight, Seat } from '$lib/db/types';
import { api } from '$lib/trpc';
import { parseCsv } from '$lib/utils';

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
  notes: z.string().transform(nullTransformer),
});

const parseFlightyDateTime = (
  actual: string | null,
  scheduled: string | null,
): Date | null => {
  try {
    const dateTimeStr = actual || scheduled;
    if (!dateTimeStr) return null;
    return new Date(dateTimeStr);
  } catch {
    return null;
  }
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
      unknownAirports: [],
    };
  }

  const flights: CreateFlight[] = [];
  const unknownAirports: string[] = [];

  for (const row of data) {
    // Parse departure and arrival times
    const departure = parseFlightyDateTime(
      row.gate_departure_actual,
      row.gate_departure_scheduled,
    );
    const arrival = parseFlightyDateTime(
      row.gate_arrival_actual,
      row.gate_arrival_scheduled,
    );

    if (!departure || !arrival) {
      console.warn('Skipping flight due to missing datetime:', row);
      continue;
    }

    const from = await api.airport.getFromIata.query(row.from);
    const to = await api.airport.getFromIata.query(row.to);

    if (!from || !to) {
      if (!from && !unknownAirports.includes(row.from)) {
        unknownAirports.push(row.from);
      }
      if (!to && !unknownAirports.includes(row.to)) {
        unknownAirports.push(row.to);
      }
      continue;
    }

    const duration = differenceInSeconds(arrival, departure);

    let airline = null;
    if (row.airline) {
      const airlineIcao = row.airline.trim().toUpperCase();
      airline = (await api.airline.getByIcao.query(airlineIcao)) ?? null;

      if (!airline) {
        airline = (await api.airline.getByIata.query(airlineIcao)) ?? null;
      }
    }

    const aircraft = null;

    const flightNumber =
      row.airline && row.flight
        ? `${row.airline}${row.flight}`.substring(0, 10)
        : null;

    // Extract date in YYYY-MM-DD format
    const date = departure.toISOString().split('T')[0]!;

    flights.push({
      date,
      from,
      to,
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
  };
};
