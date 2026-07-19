import { tz } from '@date-fns/tz/tz';
import { addSeconds } from 'date-fns';
import { z } from 'zod';

import { page } from '$app/state';
import type { PlatformOptions } from '$lib/components/modals/settings/pages/import-page';
import type { CreateFlight, FlightPassenger } from '$lib/db/types';
import { parseCsv } from '$lib/utils';
import { parseCsvLine } from '$lib/utils/csv';
import { getAircraftByIcao, getAircraftByName } from '$lib/utils/data/aircraft';
import {
  getAirlineByIata,
  getAirlineByIcao,
  getAirlineByName,
} from '$lib/utils/data/airlines';
import {
  getAirportByIata,
  getAirportByIcao,
} from '$lib/utils/data/airports/cache';
import { parseLocalISO, toUtc } from '$lib/utils/datetime';

const OPENFLIGHTS_RAW_BASE_URL =
  'https://raw.githubusercontent.com/jpatokal/openflights/master/data';

const nullTransformer = (value: string) => {
  const trimmed = value.trim();
  return !trimmed || trimmed === '\\N' || trimmed === 'N/A' ? null : trimmed;
};

const OpenFlightsFlight = z.object({
  date: z
    .string()
    .min(1)
    .transform((value) => value.replace(/^\uFEFF/, '')),
  from: z.string().transform(nullTransformer),
  to: z.string().transform(nullTransformer),
  flight_number: z.string().transform(nullTransformer),
  airline: z.string().transform(nullTransformer),
  distance: z.string().transform(nullTransformer),
  duration: z.string().transform(nullTransformer),
  seat: z.string().transform(nullTransformer),
  seat_type: z.string().transform(nullTransformer),
  class: z.string().transform(nullTransformer),
  reason: z.string().transform(nullTransformer),
  plane: z.string().transform(nullTransformer),
  registration: z.string().transform(nullTransformer),
  trip: z.string().transform(nullTransformer),
  note: z.string().transform(nullTransformer),
  from_oid: z.string().transform(nullTransformer),
  to_oid: z.string().transform(nullTransformer),
  airline_oid: z.string().transform(nullTransformer),
  plane_oid: z.string().transform(nullTransformer),
});

type OpenFlightsAirline = {
  id: string;
  name: string | null;
  alias: string | null;
  iata: string | null;
  icao: string | null;
};

type OpenFlightsPlane = {
  name: string;
  iata: string | null;
  icao: string | null;
};

type OpenFlightsData = {
  airlinesById: Map<string, OpenFlightsAirline>;
  planesByRowNumber: Map<string, OpenFlightsPlane>;
  planesByName: Map<string, OpenFlightsPlane>;
};

let openFlightsDataPromise: Promise<OpenFlightsData> | null = null;

const parseOpenFlightsValue = (value: string | undefined): string | null => {
  if (value === undefined) return null;
  return nullTransformer(value);
};

const fetchOpenFlightsDataFile = async (file: string): Promise<string> => {
  const response = await fetch(`${OPENFLIGHTS_RAW_BASE_URL}/${file}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch OpenFlights ${file}: ${response.status}`);
  }
  return await response.text();
};

const parseAirlines = (content: string): Map<string, OpenFlightsAirline> => {
  const airlines = new Map<string, OpenFlightsAirline>();

  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    const values = parseCsvLine(line);
    const id = parseOpenFlightsValue(values[0]);
    if (!id) continue;

    airlines.set(id, {
      id,
      name: parseOpenFlightsValue(values[1]),
      alias: parseOpenFlightsValue(values[2]),
      iata: parseOpenFlightsValue(values[3])?.toUpperCase() ?? null,
      icao: parseOpenFlightsValue(values[4])?.toUpperCase() ?? null,
    });
  }

  return airlines;
};

const parsePlanes = (content: string): Map<string, OpenFlightsPlane> => {
  const planes = new Map<string, OpenFlightsPlane>();
  let rowNumber = 0;

  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    rowNumber += 1;
    const values = parseCsvLine(line);
    const name = parseOpenFlightsValue(values[0]);
    if (!name) continue;

    planes.set(String(rowNumber), {
      name,
      iata: parseOpenFlightsValue(values[1])?.toUpperCase() ?? null,
      icao: parseOpenFlightsValue(values[2])?.toUpperCase() ?? null,
    });
  }

  return planes;
};

const indexPlanesByName = (
  planes: Map<string, OpenFlightsPlane>,
): Map<string, OpenFlightsPlane> => {
  const byName = new Map<string, OpenFlightsPlane>();
  for (const plane of planes.values()) {
    byName.set(plane.name.toLowerCase(), plane);
  }
  return byName;
};

const getOpenFlightsData = async (): Promise<OpenFlightsData> => {
  openFlightsDataPromise ??= Promise.all([
    fetchOpenFlightsDataFile('airlines.dat'),
    fetchOpenFlightsDataFile('planes.dat'),
  ]).then(([airlines, planes]) => {
    const planesByRowNumber = parsePlanes(planes);

    return {
      airlinesById: parseAirlines(airlines),
      planesByRowNumber,
      planesByName: indexPlanesByName(planesByRowNumber),
    };
  });

  return openFlightsDataPromise;
};

const parseOpenFlightsDate = (
  input: string,
): { date: string; time: string | null; datePrecision: 'day' | 'year' } => {
  const [rawDate, rawTime] = input.trim().split(/\s+/, 2);
  if (!rawDate) throw new Error('Missing OpenFlights date');

  if (/^\d{4}$/.test(rawDate)) {
    return { date: `${rawDate}-01-01`, time: null, datePrecision: 'year' };
  }

  let year: number;
  let month: number;
  let day: number;

  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(rawDate)) {
    const parts = rawDate.split('-').map(Number);
    [year, month, day] = parts as [number, number, number];
  } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(rawDate)) {
    const parts = rawDate.split('/').map(Number);
    [month, day, year] = parts as [number, number, number];
  } else if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(rawDate)) {
    const parts = rawDate.split('.').map(Number);
    [day, month, year] = parts as [number, number, number];
  } else {
    throw new Error(`Unsupported OpenFlights date: ${input}`);
  }

  const normalized = `${year.toString().padStart(4, '0')}-${month
    .toString()
    .padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`Invalid OpenFlights date: ${input}`);
  }

  return {
    date: normalized,
    time: rawTime ? normalizeTime(rawTime) : null,
    datePrecision: 'day',
  };
};

const normalizeTime = (input: string): string | null => {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(input);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;

  return `${hour.toString().padStart(2, '0')}:${minute
    .toString()
    .padStart(2, '0')}:00`;
};

const parseDuration = (duration: string | null): number | null => {
  if (!duration) return null;
  const match = /^(\d{1,3}):(\d{2})(?::(\d{2}))?$/.exec(duration.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? 0);
  if (minutes > 59 || seconds > 59) return null;

  return hours * 3600 + minutes * 60 + seconds;
};

const mapSeatType = (seatType: string | null): FlightPassenger['seat'] => {
  switch (seatType?.toUpperCase()) {
    case 'W':
      return 'window';
    case 'A':
      return 'aisle';
    case 'M':
      return 'middle';
    default:
      return null;
  }
};

const mapSeatClass = (
  seatClass: string | null,
): FlightPassenger['seatClass'] => {
  switch (seatClass?.toUpperCase()) {
    case 'F':
      return 'first';
    case 'C':
    case 'B':
      return 'business';
    case 'P':
      return 'economy+';
    case 'Y':
      return 'economy';
    default:
      return null;
  }
};

const mapFlightReason = (
  reason: string | null,
): CreateFlight['flightReason'] => {
  switch (reason?.toUpperCase()) {
    case 'B':
      return 'business';
    case 'L':
    case 'P':
      return 'leisure';
    case 'C':
      return 'crew';
    case 'O':
      return 'other';
    default:
      return null;
  }
};

const isAirlineCode = (value: string | null): value is string => {
  if (!value) return false;
  return /^[A-Z0-9]{2}$/.test(value) && !/^\d{2}$/.test(value);
};

const extractAirlineIataFromFlightNumber = (
  flightNumber: string | null,
): string | null => {
  if (!flightNumber || flightNumber.length < 2) return null;
  const code = flightNumber.slice(0, 2).toUpperCase();
  return isAirlineCode(code) ? code : null;
};

const normalizeAirportCode = (code: string | null): string | null => {
  if (!code) return null;
  const normalized = code.toUpperCase();
  return /^[A-Z0-9]{3,4}$/.test(normalized) ? normalized : null;
};

const buildNote = (
  note: string | null,
  trip: string | null,
  distance: string | null,
) => {
  const parts: string[] = [];
  if (note) parts.push(note);
  if (trip) parts.push(`OpenFlights trip: ${trip}`);
  if (distance) parts.push(`OpenFlights distance: ${distance} mi`);
  return parts.length ? parts.join(' | ') : null;
};

const lookupAirport = async (
  rowCode: string | null,
  mappedAirport: PlatformOptions['airportMapping'],
) => {
  const code = normalizeAirportCode(rowCode);
  const mappingKey = code ?? rowCode ?? 'Unknown';

  if (mappedAirport?.[mappingKey]) {
    return { airport: mappedAirport[mappingKey], mappingKey };
  }

  const airport =
    code && code.length === 4
      ? await getAirportByIcao(code)
      : code
        ? await getAirportByIata(code)
        : null;

  return { airport, mappingKey };
};

const lookupAirline = async (
  row: z.infer<typeof OpenFlightsFlight>,
  data: OpenFlightsData,
  options: PlatformOptions,
) => {
  const fromOid = row.airline_oid
    ? data.airlinesById.get(row.airline_oid)
    : undefined;
  const flightNumberIata = options.airlineFromFlightNumber
    ? extractAirlineIataFromFlightNumber(row.flight_number)
    : null;
  const iata = flightNumberIata ?? fromOid?.iata ?? null;
  const icao = fromOid?.icao ?? null;
  const name = fromOid?.name ?? row.airline;
  const alias = fromOid?.alias ?? null;
  const mappingKey = icao ?? iata ?? name ?? row.airline_oid ?? null;

  if (mappingKey && options.airlineMapping?.[mappingKey]) {
    return { airline: options.airlineMapping[mappingKey], mappingKey };
  }

  let airline = icao ? await getAirlineByIcao(icao) : null;
  airline ??= iata ? await getAirlineByIata(iata) : null;
  airline ??= name ? await getAirlineByName(name) : null;
  airline ??= alias ? await getAirlineByName(alias) : null;

  if (!airline && row.airline && row.airline !== name) {
    airline = await getAirlineByName(row.airline);
  }

  return { airline, mappingKey };
};

const lookupAircraft = async (
  row: z.infer<typeof OpenFlightsFlight>,
  data: OpenFlightsData,
  options: PlatformOptions,
) => {
  const byOid = row.plane_oid
    ? data.planesByRowNumber.get(row.plane_oid)
    : undefined;
  const byName = row.plane
    ? data.planesByName.get(row.plane.toLowerCase())
    : undefined;
  const openFlightsPlane =
    row.plane && byOid?.name.toLowerCase() !== row.plane.toLowerCase()
      ? byName
      : (byOid ?? byName);
  const icao = openFlightsPlane?.icao ?? null;
  const name = openFlightsPlane?.name ?? row.plane;
  const mappingKey = icao ?? name ?? row.plane_oid ?? null;

  if (mappingKey && options.aircraftMapping?.[mappingKey]) {
    return { aircraft: options.aircraftMapping[mappingKey], mappingKey };
  }

  let aircraft = icao ? await getAircraftByIcao(icao) : null;
  aircraft ??= name ? await getAircraftByName(name) : null;

  return { aircraft, mappingKey };
};

export const processOpenFlightsFile = async (
  content: string,
  options: PlatformOptions,
) => {
  const userId = page.data.user?.id;
  if (!userId) {
    throw new Error('User not found');
  }

  const [{ rows: data, skipped }, openFlightsData] = await Promise.all([
    Promise.resolve(parseCsv(content, OpenFlightsFlight)),
    getOpenFlightsData(),
  ]);

  const flights: CreateFlight[] = [];
  const unknownAirports: Record<string, number[]> = {};
  const unknownAirlines: Record<string, number[]> = {};
  const unknownAircraft: Record<string, number[]> = {};
  let skippedInvalidRows = 0;

  for (const row of data) {
    let parsedDate: ReturnType<typeof parseOpenFlightsDate>;
    try {
      parsedDate = parseOpenFlightsDate(row.date);
    } catch (error) {
      console.warn('Skipping OpenFlights row with invalid date:', row, error);
      skippedInvalidRows += 1;
      continue;
    }

    const { airport: from, mappingKey: fromKey } = await lookupAirport(
      row.from,
      options.airportMapping,
    );
    const { airport: to, mappingKey: toKey } = await lookupAirport(
      row.to,
      options.airportMapping,
    );
    const { airline, mappingKey: airlineKey } = await lookupAirline(
      row,
      openFlightsData,
      options,
    );
    const { aircraft, mappingKey: aircraftKey } = await lookupAircraft(
      row,
      openFlightsData,
      options,
    );
    const duration = parseDuration(row.duration);

    const departure =
      parsedDate.time && parsedDate.datePrecision === 'day'
        ? toUtc(
            parseLocalISO(
              `${parsedDate.date}T${parsedDate.time}`,
              from?.tz || 'UTC',
            ),
          )
        : null;
    const arrival =
      departure && duration !== null
        ? addSeconds(departure, duration, { in: tz('UTC') })
        : null;

    const flightIndex = flights.length;
    if (!from) {
      unknownAirports[fromKey] ??= [];
      unknownAirports[fromKey].push(flightIndex);
    }
    if (!to) {
      unknownAirports[toKey] ??= [];
      unknownAirports[toKey].push(flightIndex);
    }
    if (!airline && airlineKey) {
      unknownAirlines[airlineKey] ??= [];
      unknownAirlines[airlineKey].push(flightIndex);
    }
    if (!aircraft && aircraftKey) {
      unknownAircraft[aircraftKey] ??= [];
      unknownAircraft[aircraftKey].push(flightIndex);
    }

    flights.push({
      date: parsedDate.date,
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
      datePrecision: parsedDate.datePrecision,
      departureTerminal: null,
      departureGate: null,
      arrivalTerminal: null,
      arrivalGate: null,
      duration,
      flightReason: mapFlightReason(row.reason),
      note: buildNote(row.note, row.trip, row.distance),
      aircraft,
      aircraftReg: row.registration,
      airline,
      flightNumber: row.flight_number,
      passengers: [
        {
          userId,
          seat: mapSeatType(row.seat_type),
          seatNumber: row.seat,
          seatClass: mapSeatClass(row.class),
          guestName: null,
        },
      ],
    });
  }

  return {
    flights,
    unknownAirports,
    unknownAirlines,
    unknownAircraft,
    skippedRows: skipped.length + skippedInvalidRows,
  };
};
