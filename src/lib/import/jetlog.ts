import { tz } from '@date-fns/tz';
import { addDays, differenceInSeconds, isBefore } from 'date-fns';
import { z } from 'zod';

import { page } from '$app/state';
import type { PlatformOptions } from '$lib/components/modals/settings/pages/import-page';
import type { CreateFlight, Seat } from '$lib/db/types';
import { api } from '$lib/trpc';
import { distanceBetween, parseCsv } from '$lib/utils';
import { estimateFlightDuration, parseLocal, toUtc } from '$lib/utils/datetime';

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
      unknownAirports: [],
    };
  }

  const flights: CreateFlight[] = [];
  const unknownAirports: string[] = [];

  for (const row of data) {
    const from = await api.airport.get.query(row.origin);
    const to = await api.airport.get.query(row.destination);
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
    let arrival =
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

    // If arrival time appears to be before departure time (e.g., overnight flight with no explicit arrival_date),
    // assume arrival is on the next day.
    if (departure && arrival && isBefore(arrival, departure)) {
      arrival = addDays(arrival, 1, { in: tz('UTC') });
    }

    // We ignore the duration provided by JetLog and calculate it ourselves, as theirs is at best just as good as our calculation
    const duration =
      departure && arrival
        ? differenceInSeconds(arrival, departure)
        : estimateFlightDuration(
            distanceBetween([from.lon, from.lat], [to.lon, to.lat]) / 1000,
          );

    const seatClass = row.ticket_class ?? null;

    let airline = null;
    if (row.airline) {
      const airlineIcao = row.airline.trim().toUpperCase();
      airline = (await api.airline.getByIcao.query(airlineIcao)) ?? null;
    }

    if (!airline && options.airlineFromFlightNumber && row.flight_number) {
      const airlineIata = /([A-Za-z]{2})\d*/.exec(row.flight_number)?.[1];
      airline = airlineIata
        ? ((await api.airline.getByIata.query(airlineIata)) ?? null)
        : null;
    }

    let aircraft = null;
    if (row.airplane) {
      const aircraftIcao =
        row.airplane.match(/\((.{4})\)/)?.[1] ?? row.airplane;
      aircraft = (await api.aircraft.getByIcao.query(aircraftIcao)) ?? null;
    }

    flights.push({
      date: row.date,
      from,
      to,
      departure: departure ? departure.toISOString() : null,
      arrival: arrival ? arrival.toISOString() : null,
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
  };
};
