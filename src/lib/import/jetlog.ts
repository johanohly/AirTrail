import { tz } from '@date-fns/tz';
import { addDays, differenceInSeconds, isBefore } from 'date-fns';
import { z } from 'zod';

import { page } from '$app/state';
import type { PlatformOptions } from '$lib/components/modals/settings/pages/import-page';
import type { CreateFlight, Seat } from '$lib/db/types';
import { distanceBetween, parseCsv } from '$lib/utils';
import { getAircraftByIcao } from '$lib/utils/data/aircraft';
import { getAirlineByIata, getAirlineByIcao } from '$lib/utils/data/airlines';
import { getAirportByIcao } from '$lib/utils/data/airports/cache';
import {
  estimateFlightDuration,
  parseLocalISO,
  toUtc,
} from '$lib/utils/datetime';

const nullTransformer = (v: string) => (v === '' ? null : v);
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const optionalTimePrimitive = z
  .string()
  .refine((v) => v === '' || /^\d{2}:\d{2}$/.exec(v), {
    message: 'Invalid time format',
  })
  .transform(nullTransformer);
const optionalDatePrimitive = z
  .string()
  .refine((v) => v === '' || dateRegex.exec(v), {
    message: 'Invalid date format',
  })
  .transform(nullTransformer);

const JetLogFlight = z.object({
  date: z.string().regex(dateRegex),
  origin: z.string(),
  destination: z.string(),
  departure_time: optionalTimePrimitive,
  arrival_time: optionalTimePrimitive,
  arrival_date: optionalDatePrimitive,
  seat: z.enum(['window', 'middle', 'aisle', '']).transform(nullTransformer),
  ticket_class: z
    .enum(['economy', 'economy+', 'business', 'first', 'private', ''])
    .transform(nullTransformer),
  purpose: z
    .enum(['leisure', 'business', 'crew', 'other', ''])
    .transform(nullTransformer),
  duration: z.string().transform(nullTransformer),
  distance: z.string().transform(nullTransformer),
  airplane: z.string().transform(nullTransformer),
  airline: z.string().transform(nullTransformer),
  tail_number: z.string().transform(nullTransformer),
  flight_number: z.string().transform(nullTransformer),
  notes: z.string().transform(nullTransformer),
});

export const processJetLogFile = async (
  input: string,
  options: PlatformOptions,
) => {
  const userId = page.data.user?.id;
  if (!userId) {
    throw new Error('User not found');
  }

  const [data, error] = parseCsv(input, JetLogFlight);
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
    const mappedFrom = options.airportMapping?.[row.origin];
    const mappedTo = options.airportMapping?.[row.destination];
    const from = mappedFrom ?? (await getAirportByIcao(row.origin));
    const to = mappedTo ?? (await getAirportByIcao(row.destination));

    const departure = row.departure_time
      ? toUtc(
          parseLocalISO(`${row.date}T${row.departure_time}`, from?.tz ?? 'UTC'),
        )
      : null;
    let arrival =
      row.arrival_time && row.arrival_date
        ? toUtc(
            parseLocalISO(
              `${row.arrival_date}T${row.arrival_time}`,
              to?.tz ?? 'UTC',
            ),
          )
        : row.arrival_time
          ? toUtc(
              parseLocalISO(`${row.date}T${row.arrival_time}`, to?.tz ?? 'UTC'),
            )
          : null;

    // If arrival time appears to be before departure time (e.g., overnight flight with no explicit arrival_date),
    // assume arrival is on the next day.
    if (departure && arrival && isBefore(arrival, departure)) {
      arrival = addDays(arrival, 1, { in: tz('UTC') });
    }

    // We ignore the duration provided by JetLog and calculate it ourselves, as theirs is at best just as good as our calculation
    const duration =
      departure && arrival
        ? differenceInSeconds(arrival, departure)
        : from && to
          ? estimateFlightDuration(
              distanceBetween([from.lon, from.lat], [to.lon, to.lat]) / 1000,
            )
          : null;

    const seatClass = row.ticket_class ?? null;

    let airlineCode: string | undefined;
    const mappedAirline = row.airline
      ? options.airlineMapping?.[row.airline.trim().toUpperCase()]
      : undefined;
    let airline = mappedAirline || null;

    if (!airline && row.airline) {
      airlineCode = row.airline.trim().toUpperCase();
      airline = (await getAirlineByIcao(airlineCode)) ?? null;
    }

    if (!airline && options.airlineFromFlightNumber && row.flight_number) {
      const airlineIata = /([A-Za-z]{2})\d*/.exec(row.flight_number)?.[1];
      if (airlineIata) {
        airlineCode = airlineIata;
        airline = (await getAirlineByIata(airlineIata)) ?? null;
      }
    }

    let aircraft = null;
    if (row.airplane) {
      const aircraftIcao =
        row.airplane.match(/\((.{4})\)/)?.[1] ?? row.airplane;
      aircraft = (await getAircraftByIcao(aircraftIcao)) ?? null;
    }

    const flightIndex = flights.length;

    if (!from) {
      if (!unknownAirports[row.origin]) unknownAirports[row.origin] = [];
      unknownAirports[row.origin]!.push(flightIndex);
    }
    if (!to) {
      if (!unknownAirports[row.destination])
        unknownAirports[row.destination] = [];
      unknownAirports[row.destination]!.push(flightIndex);
    }
    if (!airline && airlineCode) {
      if (!unknownAirlines[airlineCode]) unknownAirlines[airlineCode] = [];
      unknownAirlines[airlineCode]!.push(flightIndex);
    }

    flights.push({
      date: row.date,
      from: from || null,
      to: to || null,
      departure: departure ? departure.toISOString() : null,
      arrival: arrival ? arrival.toISOString() : null,
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
      flightNumber: row.flight_number
        ? row.flight_number.substring(0, 10) // limit to 10 characters
        : null,
      note: row.notes,
      airline,
      aircraft,
      aircraftReg: row.tail_number ? row.tail_number.substring(0, 10) : null,
      flightReason: row.purpose as CreateFlight['flightReason'],
      seats: [
        {
          userId,
          seat: row.seat as Seat['seat'],
          seatClass: seatClass as Seat['seatClass'],
          seatNumber: null,
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
