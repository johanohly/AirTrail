import type { CreateFlight, Seat } from '$lib/db/types';
import { parseCsv } from '$lib/utils';
import { z } from 'zod';
import { get } from 'svelte/store';
import { page } from '$app/stores';
import { airportFromICAO } from '$lib/utils/data/airports';
import { estimateFlightDuration, parseLocal, toUtc } from '$lib/utils/datetime';
import { differenceInSeconds } from 'date-fns';
import type { PlatformOptions } from '$lib/components/modals/settings/pages/import-page';
import { airlineFromIATA } from '$lib/utils/data/airlines';

const JETLOG_FLIGHT_CLASS_MAP: Record<string, Seat['seatClass']> = {
  'ClassType.ECONOMY': 'economy',
  'ClassType.ECONOMYPLUS': 'economy+',
  'ClassType.BUSINESS': 'business',
  'ClassType.FIRST': 'first',
  'ClassType.PRIVATE': 'private',
};

const nullTransformer = (v: string) => (v === '' ? null : v);

const JetLogFlight = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  origin: z.string(),
  destination: z.string(),
  departure_time: z
    .string()
    .regex(/^\d{2}:\d{2}$|/)
    .transform(nullTransformer),
  arrival_time: z
    .string()
    .regex(/^\d{2}:\d{2}$|/)
    .transform(nullTransformer),
  arrival_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$|/)
    .transform(nullTransformer),
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
    const duration = row.duration
      ? +row.duration * 60
      : departure && arrival
        ? differenceInSeconds(arrival, departure)
        : estimateFlightDuration(
            { lng: from.lon, lat: from.lat },
            { lng: to.lon, lat: to.lat },
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
