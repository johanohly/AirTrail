import type { Flight } from '$lib/db/schema';
import { parseCsv } from '$lib/utils';
import { z } from 'zod';
import dayjs from 'dayjs';

const FR24_AIRPORT_REGEX = /\((?<IATA>[a-zA-Z]{3})\/(?<ICAO>[a-zA-Z]{4})\)/;
const FR24_SEAT_TYPE_MAP: Record<string, Flight['seat']> = {
  '1': 'window',
  '2': 'middle',
  '3': 'aisle',
};
const FR24_FLIGHT_CLASS_MAP: Record<string, Flight['seatClass']> = {
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

const nullTransformer = (v: string) => v === '' ? null : v;

const FR24Flight = z.object({
  'date': z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  'flight_number': z.string().transform(nullTransformer),
  'from': z.string(),
  'to': z.string(),
  'dep_time': z.string().regex(/^\d{2}:\d{2}:\d{2}$/).nullable(),
  'arr_time': z.string().regex(/^\d{2}:\d{2}:\d{2}$/).nullable(),
  'duration': z.string().regex(/^\d{2}:\d{2}:\d{2}$/),
  'airline': z.string().transform((v) => v === ' (/)' ? null : v),
  'aircraft': z.string().transform((v) => v === ' ()' ? null : v),
  'registration': z.string().transform(nullTransformer),
  'seat_number': z.string().transform(nullTransformer),
  'seat_type': z.string().transform(nullTransformer),
  'flight_class': z.string().transform(nullTransformer),
  'flight_reason': z.string().transform(nullTransformer),
  'note': z.string().transform(nullTransformer),
});

const extractAirportIATA = (airport: string) => {
  const match = airport.match(FR24_AIRPORT_REGEX);
  if (!match) {
    console.error(`Failed to extract IATA code from airport: ${airport}`);
    return null;
  }

  return match.groups?.IATA;
};

const AIRLINE_REGEX = /(?<Name>.*) \((?<IATA>[0-9A-Z]{2})\/(?<ICAO>[a-zA-Z]{3})\)/;
const extractAirlineIATA = (airline: string) => {
  const match = airline.match(AIRLINE_REGEX);
  if (!match) {
    console.error(`Failed to extract IATA code from airline: ${airline}`);
    return null;
  }

  return match.groups?.IATA ?? null;
};

export const processFR24File = async (content: string) => {
  const [data, error] = parseCsv(content, FR24Flight);
  if (error) {
    return [];
  }

  if (data.length === 0) {
    return [];
  }

  const flights: Omit<Flight, 'id' | 'userId'>[] = [];
  for (const row of data) {
    const from = extractAirportIATA(row.from);
    const to = extractAirportIATA(row.to);
    if (!from || !to) {
      continue;
    }

    if (row.dep_time === '00:00:00' && row.arr_time === '00:00:00') {
      // set both to null
      row.dep_time = null;
      row.arr_time = null;
    }

    const departure = row.dep_time ? dayjs(`${row.date} ${row.dep_time}`, 'YYYY-MM-DD HH:mm:ss') : null;
    const arrival = row.arr_time ? dayjs(`${row.date} ${row.arr_time}`, 'YYYY-MM-DD HH:mm:ss') : null;

    const duration = row.duration.split(':').reduce((acc, val, idx) => acc + parseInt(val) * Math.pow(60, 2 - idx), 0);

    const seatType = FR24_SEAT_TYPE_MAP?.[row.seat_type ?? 'noop'] ?? null;
    const seatClass = FR24_FLIGHT_CLASS_MAP?.[row.flight_class ?? 'noop'] ?? null;
    const flightReason = FR24_FLIGHT_REASON_MAP?.[row.flight_reason ?? 'noop'] ?? null;

    const airline = row.airline ? extractAirlineIATA(row.airline) : null;

    flights.push({
      from,
      departure: departure?.unix() ?? null,
      to,
      arrival: arrival?.unix() ?? null,
      duration,
      seat: seatType,
      seatNumber: row.seat_number,
      seatClass,
      flightReason,
      note: row.note,
      aircraft: row.aircraft,
      aircraftReg: row.registration,
      airline,
      flightNumber: row.flight_number,
    });
  }

  return flights;
};
