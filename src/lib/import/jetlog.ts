import type { CreateFlight, Seat } from '$lib/db/types';
import { estimateDuration, parseCsv, toISOString } from '$lib/utils';
import { z } from 'zod';
import { get } from 'svelte/store';
import { page } from '$app/stores';
import { airportFromICAO } from '$lib/utils/data/airports';
import dayjs from 'dayjs';

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

export const processJetLogFile = async (input: string) => {
  const userId = get(page).data.user?.id;
  if (!userId) {
    throw new Error('User not found');
  }

  const [data, error] = parseCsv(input, JetLogFlight);
  if (data.length === 0 || error) {
    return [];
  }

  const flights: CreateFlight[] = [];

  for (const row of data) {
    const from = airportFromICAO(row.origin);
    const to = airportFromICAO(row.destination);
    if (!from || !to) {
      continue;
    }

    const departure = row.departure_time
      ? dayjs(`${row.date} ${row.departure_time}`, 'YYYY-MM-DD HH:mm').subtract(
          from.tz,
          'minutes',
        ) // convert to UTC (assumes local time)
      : null;
    const arrival =
      row.arrival_time && row.arrival_date
        ? dayjs(
            `${row.arrival_date} ${row.arrival_time}`,
            'YYYY-MM-DD HH:mm',
          ).subtract(to.tz, 'minutes')
        : row.arrival_time
          ? dayjs(
              `${row.date} ${row.arrival_time}`,
              'YYYY-MM-DD HH:mm',
            ).subtract(to.tz, 'minutes')
          : null;
    const duration = row.duration
      ? +row.duration * 60
      : departure && arrival
        ? arrival.diff(departure, 'seconds')
        : estimateDuration(
            { lng: from.lon, lat: from.lat },
            { lng: to.lon, lat: to.lat },
          );

    const seatClass =
      JETLOG_FLIGHT_CLASS_MAP[row.ticket_class ?? 'noop'] ?? null;

    flights.push({
      date: row.date,
      from: from.ICAO,
      to: to.ICAO,
      departure: departure ? toISOString(departure) : null,
      arrival: arrival ? toISOString(arrival) : null,
      duration,
      flightNumber: row.flight_number
        ? row.flight_number.substring(0, 10) // limit to 10 characters
        : null,
      note: row.notes,
      airline: null,
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

  return flights;
};
