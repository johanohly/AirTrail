import { z } from 'zod';

import { page } from '$app/state';
import type { CreateFlight, FlightPassenger } from '$lib/db/types';
import type { PlatformOptions, ProcessResult } from '$lib/import/model';
import { parseCsv } from '$lib/utils';
import { getAircraftByName } from '$lib/utils/data/aircraft';
import {
  getAirlineByCodes,
  getAirlineByIata,
  getAirlineByName,
} from '$lib/utils/data/airlines';
import {
  getAirportByIata,
  getAirportByIcao,
} from '$lib/utils/data/airports/cache';
import { parseLocalISO, toUtc } from '$lib/utils/datetime';

const MAX_NOTE_LENGTH = 1000;

// "2013-02-01 10:30:00" (local airport time)
const LOCAL_DATE_TIME_REGEX =
  /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?$/;
const MIDNIGHT_REGEX = /[ T]00:00(?::00)?$/;
// "Name (IATA/ICAO)", where either code can be empty: "(SXF/)" or "(/HSK)".
// Anchored to the end because names can contain parentheses themselves.
const CODED_NAME_REGEX =
  /^(.*?)\s*\(([A-Za-z0-9]{0,3})\/([A-Za-z0-9]{0,4})\)\s*$/;
// Reviews end with their rating: " (0)" or " (3, [0,0,0,0,0,0,0,0,0])"
const REVIEW_SUFFIX_REGEX = /\s*\((\d+(?:\.\d+)?)(?:\s*,\s*\[[^\]]*\])?\)\s*$/;

const SEAT_TYPE_MAP: Record<string, FlightPassenger['seat']> = {
  window: 'window',
  aisle: 'aisle',
  middle: 'middle',
};
const SEAT_CLASS_MAP: Record<string, FlightPassenger['seatClass']> = {
  economy: 'economy',
  'economy+': 'economy+',
  premium: 'economy+',
  'premium economy': 'economy+',
  business: 'business',
  first: 'first',
  private: 'private',
};
const FLIGHT_REASON_MAP: Record<
  string,
  NonNullable<FlightPassenger['flightReason']>
> = {
  vacations: 'leisure',
  vacation: 'leisure',
  leisure: 'leisure',
  personal: 'leisure',
  work: 'business',
  business: 'business',
  crew: 'crew',
};

const nullTransformer = (value: string) => {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};
const optionalText = z.string().default('').transform(nullTransformer);

const LogMyTripFlight = z.object({
  operated_as: optionalText,
  marketed_as: optionalText,
  departure_airport: z.string(),
  arrival_airport: z.string(),
  arrival_scheduled_airport: optionalText,
  airline: optionalText,
  aircraft: optionalText,
  departure_time: z.string().regex(LOCAL_DATE_TIME_REGEX),
  arrival_time: optionalText,
  departure_scheduled_time: optionalText,
  arrival_scheduled_time: optionalText,
  tail_number: optionalText,
  aircraft_nickname: optionalText,
  aircraft_livery: optionalText,
  seat_number: optionalText,
  seat_type: optionalText,
  flight_class: optionalText,
  flight_reason: optionalText,
  companions: optionalText,
  departure_terminal: optionalText,
  departure_gate: optionalText,
  arrival_terminal: optionalText,
  arrival_gate: optionalText,
  booking_number: optionalText,
  duration: z
    .string()
    .default('')
    .transform((value) => {
      const minutes = Number(value);
      return Number.isFinite(minutes) && minutes > 0
        ? Math.round(minutes)
        : null;
    }),
  general_review: optionalText,
  departure_airport_review: optionalText,
  arrival_airport_review: optionalText,
  airline_review: optionalText,
  aircraft_review: optionalText,
  service_review: optionalText,
  cancelled: z
    .string()
    .default('')
    .transform((value) => value.trim().toLowerCase() === 'true'),
});
type LogMyTripRow = z.infer<typeof LogMyTripFlight>;

const parseCodedName = (value: string) => {
  const trimmed = value.trim();
  const match = CODED_NAME_REGEX.exec(trimmed);
  if (!match) return { name: trimmed, iata: null, icao: null };
  return {
    name: (match[1] ?? '').trim(),
    iata: (match[2] ?? '').toUpperCase() || null,
    icao: (match[3] ?? '').toUpperCase() || null,
  };
};

const mapValue = <T>(
  map: Record<string, T>,
  value: string | null,
  fallback: T,
): T => {
  if (!value) return fallback;
  return map[value.trim().toLowerCase()] ?? fallback;
};

const isMidnight = (value: string | null) =>
  value !== null && MIDNIGHT_REGEX.test(value.trim());

const parseLocalDateTime = (value: string | null, tzId: string) => {
  if (!value) return null;
  const match = LOCAL_DATE_TIME_REGEX.exec(value.trim());
  if (!match) return null;
  const parsed = parseLocalISO(
    `${match[1]}T${match[2]}:${match[3] ?? '00'}`,
    tzId,
  );
  return Number.isNaN(parsed.getTime()) ? null : toUtc(parsed);
};

const resolveAirport = async (raw: string, options: PlatformOptions) => {
  const { iata, icao } = parseCodedName(raw);
  const key = icao ?? iata;
  if (!key) return { airport: null, key: null };

  const mapped = options.airportMapping?.[key];
  if (mapped) return { airport: mapped, key };

  const airport =
    (icao ? await getAirportByIcao(icao) : null) ??
    (iata ? await getAirportByIata(iata) : null);
  return { airport, key };
};

const resolveAirline = async (raw: string | null, options: PlatformOptions) => {
  if (!raw) return { airline: null, key: null };
  const { name, iata, icao } = parseCodedName(raw);
  const key = icao ?? iata ?? (name || null);
  if (!key) return { airline: null, key: null };

  const mapped = options.airlineMapping?.[key];
  if (mapped) return { airline: mapped, key };

  const airline =
    (icao
      ? await getAirlineByCodes(icao, iata, name)
      : iata
        ? await getAirlineByIata(iata)
        : null) ?? (name ? await getAirlineByName(name) : null);
  return { airline, key };
};

// "Airbus A321 (NEO)" is stored as "Airbus A321neo" in most aircraft data.
const aircraftNameVariants = (name: string) => {
  const variants = [name];
  const neo = name.replace(/\s*\(NEO\)/i, 'neo');
  if (neo !== name) variants.push(neo);
  return variants;
};

const resolveAircraft = async (
  name: string | null,
  options: PlatformOptions,
) => {
  if (!name) return null;
  const mapped = options.aircraftMapping?.[name];
  if (mapped) return mapped;
  for (const variant of aircraftNameVariants(name)) {
    const aircraft = await getAircraftByName(variant);
    if (aircraft) return aircraft;
  }
  return null;
};

const normalizeFlightNumber = (value: string | null) => {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, '').toUpperCase();
  return normalized ? normalized.substring(0, 10) : null;
};

const parseCompanions = (value: string | null) => {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is string =>
        typeof item === 'string' &&
        item.trim() !== '' &&
        item.trim().toLowerCase() !== 'alone',
    );
  } catch {
    return [];
  }
};

const formatReview = (label: string | null, value: string | null) => {
  if (!value) return null;
  const match = REVIEW_SUFFIX_REGEX.exec(value);
  const rating = match ? Number(match[1]) : 0;
  const text = (match ? value.slice(0, match.index) : value)
    .replace(/\s+/g, ' ')
    .trim();
  if (!text && rating <= 0) return null;

  const body = text
    ? `${text}${rating > 0 ? ` (rating ${rating})` : ''}`
    : `rating ${rating}`;
  return label ? `${label}: ${body}` : body;
};

// Short facts come first so that truncating a long review never drops them.
const buildNote = (row: LogMyTripRow, divertedFrom: string | null) => {
  const companions = parseCompanions(row.companions);
  const parts = [
    row.booking_number ? `PNR: ${row.booking_number}` : null,
    row.marketed_as ? `Marketed as: ${row.marketed_as}` : null,
    companions.length ? `With: ${companions.join(', ')}` : null,
    row.aircraft_nickname ? `Aircraft name: ${row.aircraft_nickname}` : null,
    row.aircraft_livery ? `Livery: ${row.aircraft_livery}` : null,
    divertedFrom ? `Diverted (planned arrival: ${divertedFrom})` : null,
    formatReview(null, row.general_review),
    formatReview('Departure airport', row.departure_airport_review),
    formatReview('Arrival airport', row.arrival_airport_review),
    formatReview('Airline', row.airline_review),
    formatReview('Aircraft', row.aircraft_review),
    formatReview('Service', row.service_review),
  ].filter((part): part is string => !!part);

  if (parts.length === 0) return null;
  const note = parts.join(' | ');
  return note.length > MAX_NOTE_LENGTH
    ? `${note.substring(0, MAX_NOTE_LENGTH - 1)}…`
    : note;
};

const addUnknown = (
  records: Record<string, number[]>,
  key: string,
  flightIndex: number,
) => {
  const indices = records[key] ?? [];
  records[key] = indices;
  indices.push(flightIndex);
};

export const processLogMyTripFile = async (
  input: string,
  options: PlatformOptions,
): Promise<ProcessResult> => {
  const userId = page.data.user?.id;
  if (!userId) {
    throw new Error('User not found');
  }

  const { rows: data, skipped } = parseCsv(input, LogMyTripFlight);

  const flights: CreateFlight[] = [];
  const unknownAirports: Record<string, number[]> = {};
  const unknownAirlines: Record<string, number[]> = {};
  const unknownAircraft: Record<string, number[]> = {};
  let droppedRows = 0;

  for (const row of data) {
    // Cancelled flights never happened, so they would distort statistics.
    if (row.cancelled) {
      console.warn('[LogMyTrip] Skipping cancelled flight', {
        operatedAs: row.operated_as,
        departureTime: row.departure_time,
      });
      droppedRows++;
      continue;
    }

    const fromResult = await resolveAirport(row.departure_airport, options);
    const toResult = await resolveAirport(row.arrival_airport, options);
    if (!fromResult.key || !toResult.key) {
      console.warn('[LogMyTrip] Skipping row with missing airport code', {
        operatedAs: row.operated_as,
        departureTime: row.departure_time,
        departureAirport: row.departure_airport,
        arrivalAirport: row.arrival_airport,
      });
      droppedRows++;
      continue;
    }
    const { airport: from, key: fromKey } = fromResult;
    const { airport: to, key: toKey } = toResult;

    const { airline, key: airlineKey } = await resolveAirline(
      row.airline,
      options,
    );
    const aircraft = await resolveAircraft(row.aircraft, options);

    // LogMyTrip exports an unknown time as 00:00:00
    const date = row.departure_time.substring(0, 10);
    const departure = !isMidnight(row.departure_time)
      ? parseLocalDateTime(row.departure_time, from?.tz ?? 'UTC')
      : null;
    let arrival: Date | null =
      row.arrival_time && !isMidnight(row.arrival_time)
        ? parseLocalDateTime(row.arrival_time, to?.tz ?? 'UTC')
        : null;
    // The server rejects an arrival before the departure, which happens when
    // an overnight flight's arrival date wasn't rolled over.
    if (departure && arrival && arrival <= departure) arrival = null;
    if (departure && !arrival && row.duration) {
      arrival = new Date(departure.getTime() + row.duration * 60_000);
    }

    const duration =
      departure && arrival
        ? Math.round((arrival.getTime() - departure.getTime()) / 1000)
        : row.duration
          ? row.duration * 60
          : null;

    // A diverted flight landed somewhere other than planned. The scheduled
    // departure still belongs to the departure airport, but the scheduled
    // arrival belongs to the planned airport (and its time zone).
    const plannedArrival = row.arrival_scheduled_airport
      ? parseCodedName(row.arrival_scheduled_airport)
      : null;
    const plannedKey = plannedArrival?.icao ?? plannedArrival?.iata ?? null;
    const diverted = !!plannedKey && plannedKey !== toKey;
    const plannedAirport =
      diverted && row.arrival_scheduled_airport
        ? (await resolveAirport(row.arrival_scheduled_airport, options)).airport
        : null;

    // LogMyTrip exports an unknown scheduled time as 00:00:00
    const hasScheduleTime = (value: string | null) =>
      !!value && !isMidnight(value);

    const departureScheduled = hasScheduleTime(row.departure_scheduled_time)
      ? parseLocalDateTime(row.departure_scheduled_time, from?.tz ?? 'UTC')
      : null;

    let arrivalScheduled: Date | null = null;
    const arrivalScheduledTz = diverted
      ? plannedAirport?.tz
      : (to?.tz ?? 'UTC');
    if (arrivalScheduledTz && hasScheduleTime(row.arrival_scheduled_time)) {
      arrivalScheduled = parseLocalDateTime(
        row.arrival_scheduled_time,
        arrivalScheduledTz,
      );
    }

    const flightIndex = flights.length;

    if (!from) addUnknown(unknownAirports, fromKey, flightIndex);
    if (!to) addUnknown(unknownAirports, toKey, flightIndex);
    if (!airline && airlineKey) {
      addUnknown(unknownAirlines, airlineKey, flightIndex);
    }
    if (!aircraft && row.aircraft) {
      addUnknown(unknownAircraft, row.aircraft, flightIndex);
    }

    flights.push({
      date,
      from: from || null,
      to: to || null,
      departure: departure ? departure.toISOString() : null,
      arrival: arrival ? arrival.toISOString() : null,
      departureScheduled: departureScheduled
        ? departureScheduled.toISOString()
        : null,
      arrivalScheduled: arrivalScheduled
        ? arrivalScheduled.toISOString()
        : null,
      takeoffScheduled: null,
      takeoffActual: null,
      landingScheduled: null,
      landingActual: null,
      datePrecision: 'day',
      departureTerminal: row.departure_terminal?.substring(0, 10) ?? null,
      departureGate: row.departure_gate?.substring(0, 10) ?? null,
      arrivalTerminal: row.arrival_terminal?.substring(0, 10) ?? null,
      arrivalGate: row.arrival_gate?.substring(0, 10) ?? null,
      duration,
      flightNumber: normalizeFlightNumber(row.operated_as),
      note: buildNote(
        row,
        diverted ? plannedArrival?.name || plannedKey : null,
      ),
      airline,
      aircraft,
      aircraftReg: row.tail_number ? row.tail_number.substring(0, 10) : null,
      passengers: [
        {
          userId,
          seat: mapValue(SEAT_TYPE_MAP, row.seat_type, null),
          seatClass: mapValue(SEAT_CLASS_MAP, row.flight_class, null),
          seatNumber: row.seat_number ? row.seat_number.substring(0, 5) : null,
          guestName: null,
          flightReason: mapValue(
            FLIGHT_REASON_MAP,
            row.flight_reason,
            row.flight_reason ? 'other' : null,
          ),
        },
      ],
    });
  }

  return {
    flights,
    unknowns: {
      airports: unknownAirports,
      airlines: unknownAirlines,
      aircraft: unknownAircraft,
    },
    exportedUsers: [],
    skippedRows: skipped.length + droppedRows,
  };
};
