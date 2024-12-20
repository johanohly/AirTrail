import { differenceInSeconds } from 'date-fns';
import { get } from 'svelte/store';
import { z } from 'zod';

import { page } from '$app/stores';
import type { PlatformOptions } from '$lib/components/modals/settings/pages/import-page';
import type { CreateFlight, Seat } from '$lib/db/types';
import { distanceBetween, parseCsv } from '$lib/utils';
import { airlineFromIATA } from '$lib/utils/data/airlines';
import { airportFromICAO } from '$lib/utils/data/legacy_airports';
import { estimateFlightDuration, parseLocal, toUtc } from '$lib/utils/datetime';

const JETLOG_FLIGHT_CLASS_MAP: Record<string, Seat['seatClass']> = {
  'ClassType.ECONOMY': 'economy',
  'ClassType.ECONOMYPLUS': 'economy+',
  'ClassType.BUSINESS': 'business',
  'ClassType.FIRST': 'first',
  'ClassType.PRIVATE': 'private',
};

const nullTransformer = (v: string) => (v === '' ? null : v);
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const optionalTimePrimitive = z
  .string()
  .refine((v) => v === '' || v.match(/^\d{2}:\d{2}$/), {
    message: 'Invalid time format',
  })
  .transform(nullTransformer);
const optionalDatePrimitive = z
  .string()
  .refine((v) => v === '' || v.match(dateRegex), {
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
  ticket_class: z.string().transform(nullTransformer),
  duration: z.string().transform(nullTransformer),
  distance: z.string().transform(nullTransformer),
  airplane: z.string().transform(nullTransformer),
  flight_number: z.string().transform(nullTransformer),
  notes: z.string().transform(nullTransformer),
});

export const processJetLogFile = async (
  input: string,
  options: PlatformOptions,
) => {
  const userId = get(page).data.user?.id;
  if (!userId) {
    throw new Error('User not found');
  }

  const [data, error] = parseCsv(input, JetLogFlight);
  if (data.length === 0 || error) {
    return {
      flights: [],
      unknownAirports: [],
    };
  }

  const flights: CreateFlight[] = [];
  const unknownAirports: string[] = [];

  for (const row of data) {
    const from = airportFromICAO(row.origin);
    const to = airportFromICAO(row.destination);
    if (!from || !to) {
      if (!from && !unknownAirports.includes(row.origin)) {
        unknownAirports.push(row.origin);
      }
      if (!to && !unknownAirports.includes(row.destination)) {
        unknownAirports.push(row.destination);
      }
      continue;
    }

    const departure = row.departure_time
      ? toUtc(
          parseLocal(
            `${row.date} ${row.departure_time}`,
            'yyyy-MM-dd HH:mm',
            from.tz,
          ),
        )
      : null;
    const arrival =
      row.arrival_time && row.arrival_date
        ? toUtc(
            parseLocal(
              `${row.arrival_date} ${row.arrival_time}`,
              'yyyy-MM-dd HH:mm',
              to.tz,
            ),
          )
        : row.arrival_time
          ? toUtc(
              parseLocal(
                `${row.date} ${row.arrival_time}`,
                'yyyy-MM-dd HH:mm',
                to.tz,
              ),
            )
          : null;

    // We ignore the duration provided by JetLog and calculate it ourselves, as theirs is at best just as good as our calculation
    const duration =
      departure && arrival
        ? differenceInSeconds(arrival, departure)
        : estimateFlightDuration(
            distanceBetween([from.lat, from.lon], [to.lat, to.lon]) / 1000,
          );

    const seatClass =
      JETLOG_FLIGHT_CLASS_MAP[row.ticket_class ?? 'noop'] ?? null;

    let airline = null;
    if (options.airlineFromFlightNumber && row.flight_number) {
      const airlineIata = row.flight_number.match(/([A-Za-z]{2})\d*/)?.[1];
      airline = airlineIata
        ? (airlineFromIATA(airlineIata)?.icao ?? null)
        : null;
    }

    flights.push({
      date: row.date,
      from: from.ICAO,
      to: to.ICAO,
      departure: departure ? departure.toISOString() : null,
      arrival: arrival ? arrival.toISOString() : null,
      duration,
      flightNumber: row.flight_number
        ? row.flight_number.substring(0, 10) // limit to 10 characters
        : null,
      note: row.notes,
      airline,
      aircraft: null,
      aircraftReg: null,
      flightReason: null,
      seats: [
        {
          userId,
          seat: row.seat as Seat['seat'],
          seatClass,
          seatNumber: null,
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
