import { tz, TZDate } from '@date-fns/tz';
import { addDays, differenceInSeconds, isBefore } from 'date-fns';
import { z } from 'zod';

import { page } from '$app/state';
import type { PlatformOptions } from '$lib/components/modals/settings/pages/import-page';
import type { CreateFlight, Seat } from '$lib/db/types';
import { parseCsv } from '$lib/utils';
import { getAirlineByIata, getAirlineByIcao } from '$lib/utils/data/airlines';
import { getAirportByIata } from '$lib/utils/data/airports/cache';
import { parseLocalISO, toUtc } from '$lib/utils/datetime';

const nullTransformer = (v: string) => (v === '' ? null : v);

const ByAirFlight = z.object({
  flight_date: z.string(),
  flight_code: z.string().transform(nullTransformer),
  departure_airport_code: z.string(),
  arrival_airport_code: z.string(),
  departure_time: z.string().transform(nullTransformer),
  arrival_time: z.string().transform(nullTransformer),
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

const parseByAirTime = (
  date: string,
  time: string | null,
  airportTz: string,
): TZDate | null => {
  if (!time) return null;
  const iso = `${date}T${time}:00`;
  const parsed = parseLocalISO(iso, airportTz);
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
    default:
      return 'other';
  }
};

const mapSeatTypeFromClass = (seatClass: string | null): Seat['seat'] => {
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

const mapSeatClass = (seatClass: string | null): Seat['seatClass'] => {
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
): CreateFlight['flightReason'] => {
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

  const [data, error] = parseCsv(input, ByAirFlight);
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
    if (options.filterOwner && row.ownership !== 'mine') {
      continue;
    }

    const fromCode = row.departure_airport_code.trim();
    const toCode = row.arrival_airport_code.trim();

    const mappedFrom = options.airportMapping?.[fromCode];
    const mappedTo = options.airportMapping?.[toCode];
    const from = mappedFrom ?? (await getAirportByIata(fromCode));
    const to = mappedTo ?? (await getAirportByIata(toCode));

    const departure = parseByAirTime(
      row.flight_date,
      row.departure_time,
      from?.tz ?? 'UTC',
    );
    const arrival = parseByAirTime(
      row.flight_date,
      row.arrival_time,
      to?.tz ?? 'UTC',
    );

    let adjustedArrival = arrival;
    if (departure && adjustedArrival && isBefore(adjustedArrival, departure)) {
      adjustedArrival = addDays(adjustedArrival, 1, { in: tz('UTC') });
    }

    const duration =
      departure && adjustedArrival
        ? differenceInSeconds(adjustedArrival, departure)
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

    const date = row.flight_date;

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
      date,
      from: from || null,
      to: to || null,
      departure: departure ? departure.toISOString() : null,
      arrival: adjustedArrival ? adjustedArrival.toISOString() : null,
      departureScheduled: null,
      arrivalScheduled: null,
      takeoffScheduled: null,
      takeoffActual: null,
      landingScheduled: null,
      landingActual: null,
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
      flightReason: mapFlightReason(row.purpose),
      seats: [
        {
          userId,
          seat:
            mapSeatTypeFromClass(row.seat_class) ?? mapSeatType(row.seat_type),
          seatClass: mapSeatClass(row.seat_class),
          seatNumber: row.seat_number ? row.seat_number.substring(0, 5) : null,
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
