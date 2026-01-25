import { tz } from '@date-fns/tz/tz';
import { addDays, isBefore } from 'date-fns';
import { z } from 'zod';

import { page } from '$app/state';
import type { PlatformOptions } from '$lib/components/modals/settings/pages/import-page';
import type { Flight, CreateFlight, Seat } from '$lib/db/types';
import { api } from '$lib/trpc';
import { parseCsv } from '$lib/utils';
import { parseLocalISO, toUtc } from '$lib/utils/datetime';

const FR24_AIRPORT_REGEX = /\(([a-zA-Z]{3})\/(?<ICAO>[a-zA-Z]{4})\)/;
const FR24_SEAT_TYPE_MAP: Record<string, Seat['seat']> = {
  '1': 'window',
  '2': 'middle',
  '3': 'aisle',
};
const FR24_FLIGHT_CLASS_MAP: Record<string, Seat['seatClass']> = {
  '1': 'economy',
  '2': 'business',
  '3': 'first',
  '4': 'economy+',
  '5': 'private',
};
const FR24_FLIGHT_REASON_MAP: Record<string, Flight['flightReason']> = {
  '1': 'leisure',
  '2': 'business',
  '3': 'crew',
  '4': 'other',
};

const nullTransformer = (v: string) => (v === '' ? null : v);

const FR24Flight = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  flight_number: z.string().transform(nullTransformer),
  from: z.string(),
  to: z.string(),
  dep_time: z
    .string()
    .regex(/^\d{2}:\d{2}:\d{2}$/)
    .nullable(),
  arr_time: z
    .string()
    .regex(/^\d{2}:\d{2}:\d{2}$/)
    .nullable(),
  duration: z.string().regex(/^\d{2}:\d{2}:\d{2}$/),
  airline: z.string().transform((v) => (v === ' (/)' ? null : v)),
  aircraft: z.string().transform((v) => (v === ' ()' ? null : v)),
  registration: z.string().transform(nullTransformer),
  seat_number: z.string().transform(nullTransformer),
  seat_type: z.string().transform(nullTransformer),
  flight_class: z.string().transform(nullTransformer),
  flight_reason: z.string().transform(nullTransformer),
  note: z.string().transform(nullTransformer),
});

const extractAirportICAO = (airport: string) => {
  const match = FR24_AIRPORT_REGEX.exec(airport);
  if (!match) {
    console.error(`Failed to extract ICAO code from airport: ${airport}`);
    return null;
  }

  return match.groups?.ICAO;
};

const AIRLINE_REGEX = /(.*) \(([0-9A-Z]{2})\/(?<ICAO>[a-zA-Z]{3})\)/;
const extractAirlineICAO = (airline: string) => {
  const match = AIRLINE_REGEX.exec(airline);
  if (!match) {
    console.error(`Failed to extract ICAO code from airline: ${airline}`);
    return null;
  }

  return match.groups?.ICAO ?? null;
};

const AIRCRAFT_REGEX = /(.*) \((?<ICAO>[A-Z0-9-]{1,4})\)/;
const extractAircraftICAO = (aircraft: string) => {
  const match = AIRCRAFT_REGEX.exec(aircraft);
  if (!match) {
    console.error(`Failed to extract ICAO code from aircraft: ${aircraft}`);
    return null;
  }

  return match.groups?.ICAO ?? null;
};

export const processFR24File = async (
  content: string,
  options: PlatformOptions,
) => {
  const [data, error] = parseCsv(content, FR24Flight);
  if (error) {
    throw error;
  }

  const userId = page.data.user?.id;
  if (!userId) {
    throw new Error('User not found');
  }

  const flights: CreateFlight[] = [];
  const unknownAirports: Record<string, number[]> = {};
  const unknownAirlines: Record<string, number[]> = {};
  for (const row of data) {
    const fromCode = extractAirportICAO(row.from);
    const toCode = extractAirportICAO(row.to);
    if (!fromCode || !toCode) {
      continue;
    }

    const mappedFrom = options.airportMapping?.[fromCode];
    const mappedTo = options.airportMapping?.[toCode];
    const from = mappedFrom ?? (await api.airport.getFromIcao.query(fromCode));
    const to = mappedTo ?? (await api.airport.getFromIcao.query(toCode));

    if (row.dep_time === '00:00:00' && row.arr_time === '00:00:00') {
      row.dep_time = null;
      row.arr_time = null;
    }

    const departure = row.dep_time
      ? toUtc(parseLocalISO(`${row.date}T${row.dep_time}`, from?.tz || 'UTC'))
      : null;
    let arrival = row.arr_time
      ? toUtc(parseLocalISO(`${row.date}T${row.arr_time}`, to?.tz || 'UTC'))
      : null;
    if (departure && arrival && isBefore(arrival, departure)) {
      // assume arrival is on the next day
      arrival = addDays(arrival, 1, { in: tz('UTC') });
    }

    const duration = row.duration
      .split(':')
      .reduce(
        (acc, val, idx) => acc + parseInt(val) * Math.pow(60, 2 - idx),
        0,
      );

    const seatType = FR24_SEAT_TYPE_MAP?.[row.seat_type ?? 'noop'] ?? null;
    const seatClass =
      FR24_FLIGHT_CLASS_MAP?.[row.flight_class ?? 'noop'] ?? null;
    const flightReason =
      FR24_FLIGHT_REASON_MAP?.[row.flight_reason ?? 'noop'] ?? null;

    const rawAirline = row.airline ? extractAirlineICAO(row.airline) : null;
    const mappedAirline = rawAirline
      ? options.airlineMapping?.[rawAirline]
      : undefined;
    const airline =
      mappedAirline ||
      (rawAirline
        ? (await api.airline.getByIcao.query(rawAirline)) || null
        : null);

    const rawAircraft = row.aircraft ? extractAircraftICAO(row.aircraft) : null;
    const aircraft = rawAircraft
      ? await api.aircraft.getByIcao.query(rawAircraft)
      : null;
    if (!aircraft && rawAircraft) {
      console.warn(`Unknown aircraft ICAO code: ${rawAircraft}`);
    }

    const flightIndex = flights.length;

    if (!from) {
      if (!unknownAirports[fromCode]) unknownAirports[fromCode] = [];
      unknownAirports[fromCode].push(flightIndex);
    }
    if (!to) {
      if (!unknownAirports[toCode]) unknownAirports[toCode] = [];
      unknownAirports[toCode].push(flightIndex);
    }
    if (!airline && rawAirline) {
      if (!unknownAirlines[rawAirline]) unknownAirlines[rawAirline] = [];
      unknownAirlines[rawAirline].push(flightIndex);
    }

    flights.push({
      date: row.date, // YYYY-MM-DD
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
      flightReason,
      note: row.note,
      aircraft,
      aircraftReg: row.registration,
      airline,
      flightNumber: row.flight_number,
      seats: [
        {
          userId,
          seat: seatType,
          seatNumber: row.seat_number,
          seatClass,
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
