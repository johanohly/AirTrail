import { tz, TZDate } from '@date-fns/tz';
import {
  differenceInCalendarDays,
  format,
  isValid,
  parse,
  parseISO,
  subDays,
  addDays,
} from 'date-fns';

import type {
  FlightLookupProviderOptions,
  FlightLookupResult,
} from './flight-lookup';

import type { Aircraft, Airline } from '$lib/db/types';
import { getAircraftByIcao } from '$lib/server/utils/aircraft';
import { getAirlineByIcao, getAirlineByIata } from '$lib/server/utils/airline';
import { getAirportByIcao } from '$lib/server/utils/airport';
import { appConfig } from '$lib/server/utils/config';
import { RequestRateLimiter } from '$lib/utils/ratelimiter';
import type { AeroDataBoxEndpoint } from '$lib/zod/config';

const AERODATABOX_GATEWAYS: Record<
  AeroDataBoxEndpoint,
  { baseUrl: string; authHeader: string }
> = {
  rapidapi: {
    baseUrl: 'https://aerodatabox.p.rapidapi.com',
    authHeader: 'x-rapidapi-key',
  },
  direct: {
    baseUrl: 'https://api.aerodatabox.com',
    authHeader: 'X-Api-Key',
  },
};

const rateLimiter = new RequestRateLimiter(1, 1, 2, 1, 1000);

type AedbxTime = { local?: string; utc?: string };

type AedbxMovement = {
  airport: { icao?: string; timeZone?: string };
  terminal?: string;
  gate?: string;
  scheduledTime?: AedbxTime;
  revisedTime?: AedbxTime;
  runwayTime?: AedbxTime;
  predictedTime?: AedbxTime;
  quality?: string[];
};

type AedbxFlight = {
  departure: AedbxMovement;
  arrival: AedbxMovement;
  airline?: { iata?: string; icao?: string };
  aircraft?: { reg?: string };
};

/**
 * A movement time is only unambiguously a gate time when `revisedTime` and
 * `runwayTime` are both present and differ; then `runwayTime` is the runway
 * time and `revisedTime` the gate (off-block/on-block) time.
 */
type MovementTimes = {
  /** Best estimate of the gate time (revised, falling back to scheduled). */
  actual: TZDate | null;
  /** Actual/estimated wheels-off (departure) or touchdown (arrival) time. */
  runway: TZDate | null;
  /** True when the API guarantees the gate-vs-runway semantics above. */
  isGateTime: boolean;
};

function sanitizeFlightNumber(fn: string): string {
  // Remove spaces and dashes, uppercase (e.g., "SK 728" -> "SK728")
  return fn.replace(/\s|-/g, '').toUpperCase();
}

/**
 * Parse a movement time into the movement's airport timezone.
 *
 * The `utc` member is a plain ISO-8601 string, so it is parsed into an instant
 * and only then re-contextualized in the airport timezone. The `local` member
 * (e.g. `2019-08-29 06:25+01:00`) is only used when `utc` is missing.
 */
function parseMovementTime(
  time: AedbxTime | undefined,
  tzId: string,
): TZDate | null {
  if (!time) return null;

  if (time.utc) {
    const instant = parseISO(time.utc);
    if (isValid(instant)) return new TZDate(instant, tzId);
  }

  if (!time.local) return null;
  const parsed = parse(time.local, 'yyyy-MM-dd HH:mmxxx', new Date(), {
    in: tz(tzId),
  });
  return isValid(parsed) ? parsed : null;
}

/**
 * Resolve the times of a departure/arrival movement. `predictedTime` is
 * intentionally never read: it is an experimental prediction, not an actual
 * or estimated time.
 */
function resolveMovementTimes(
  movement: AedbxMovement,
  tzId: string,
): MovementTimes {
  const revised = parseMovementTime(movement.revisedTime, tzId);
  const runway = parseMovementTime(movement.runwayTime, tzId);
  const actual = revised ?? parseMovementTime(movement.scheduledTime, tzId);

  const isGateTime =
    revised !== null &&
    runway !== null &&
    revised.getTime() !== runway.getTime();

  return { actual, runway, isGateTime };
}

const MAX_TAXI_MINUTES = 120;
const AIRBORNE_MIN_MINUTES = 10;
const AIRBORNE_MAX_MINUTES = 18 * 60;

/** Whole minutes from `earlier` to `later`, rounded. */
const minutesBetween = (later: Date, earlier: Date): number =>
  Math.round((later.getTime() - earlier.getTime()) / 60_000);

const sanitizeTaxiMinutes = (minutes: number): number | null =>
  minutes >= 0 && minutes <= MAX_TAXI_MINUTES ? minutes : null;

const sanitizeAirborneMinutes = (minutes: number): number | null =>
  minutes >= AIRBORNE_MIN_MINUTES && minutes <= AIRBORNE_MAX_MINUTES
    ? minutes
    : null;

async function fetchAeroDataBox(path: string): Promise<Response> {
  const integrations = (await appConfig.get())?.integrations;
  if (!integrations?.aeroDataBoxKey) {
    throw new Error('AeroDataBox API key not configured');
  }
  const { baseUrl, authHeader } =
    AERODATABOX_GATEWAYS[integrations.aeroDataBoxEndpoint];

  return fetch(`${baseUrl}${path}`, {
    headers: { [authHeader]: integrations.aeroDataBoxKey },
  });
}

function isValidDateWithin365(date: Date): boolean {
  if (!isValid(date)) return false;
  const diff = Math.abs(differenceInCalendarDays(date, new Date()));
  return diff <= 365;
}

export async function getFlightRoute(
  flightNumber: string,
  opts?: FlightLookupProviderOptions,
): Promise<FlightLookupResult> {
  await rateLimiter.checkRequest();

  const cleaned = sanitizeFlightNumber(flightNumber);

  const date = opts?.date;
  if (date && !isValidDateWithin365(date)) {
    throw new Error('Date must be within 365 days of today');
  }

  let path: string;
  if (date) {
    path = `/flights/number/${encodeURIComponent(
      cleaned,
    )}/${format(date, 'yyyy-MM-dd')}?dateLocalRole=Both&withAircraftImage=false&withLocation=false`;
  } else {
    const now = new Date();
    const fromDate = format(subDays(now, 2), 'yyyy-MM-dd');
    const toDate = format(addDays(now, 2), 'yyyy-MM-dd');
    path = `/flights/number/${encodeURIComponent(
      cleaned,
    )}/${fromDate}/${toDate}?dateLocalRole=Both`;
  }

  const resp = await fetchAeroDataBox(path);

  if (resp.status === 204) {
    throw new Error('No matching flights found');
  }
  if (!resp.ok) {
    console.error('Failed to fetch flight data:', resp.statusText);
    throw new Error('Failed to fetch flight data');
  }

  const data = (await resp.json()) as AedbxFlight[];
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('No matching flights found');
  }

  const result: FlightLookupResult = [];
  for (const item of data) {
    if (!item.departure.airport.icao || !item.arrival.airport.icao) {
      continue;
    }

    const fromAirport = await getAirportByIcao(item.departure.airport.icao);
    const toAirport = await getAirportByIcao(item.arrival.airport.icao);

    if (!fromAirport || !toAirport) {
      continue;
    }

    const depTz = item.departure.airport.timeZone ?? fromAirport.tz;
    const arrTz = item.arrival.airport.timeZone ?? toAirport.tz;

    // Actual time (best estimate of what actually happened)
    const depTimes = resolveMovementTimes(item.departure, depTz);
    const arrTimes = resolveMovementTimes(item.arrival, arrTz);
    const departureTime = depTimes.actual;
    const arrivalTime = arrTimes.actual;

    // Scheduled time
    const departureScheduled = parseMovementTime(
      item.departure.scheduledTime,
      depTz,
    );
    const arrivalScheduled = parseMovementTime(
      item.arrival.scheduledTime,
      arrTz,
    );

    // Informational durations derived at fetch time; never persisted.
    const taxiOut =
      depTimes.isGateTime && depTimes.actual && depTimes.runway
        ? sanitizeTaxiMinutes(minutesBetween(depTimes.runway, depTimes.actual))
        : null;
    const taxiIn =
      arrTimes.isGateTime && arrTimes.actual && arrTimes.runway
        ? sanitizeTaxiMinutes(minutesBetween(arrTimes.actual, arrTimes.runway))
        : null;
    const airborneTime =
      depTimes.isGateTime &&
      arrTimes.isGateTime &&
      depTimes.runway &&
      arrTimes.runway
        ? sanitizeAirborneMinutes(
            minutesBetween(arrTimes.runway, depTimes.runway),
          )
        : null;

    let airline: Airline | null = null;
    if (item.airline?.icao) {
      airline = await getAirlineByIcao(item.airline.icao);
    }
    if (item.airline?.iata && !airline) {
      airline = await getAirlineByIata(item.airline.iata);
    }

    const flightInfo = {
      from: fromAirport,
      to: toAirport,
      departure: departureTime,
      arrival: arrivalTime,
      departureScheduled,
      arrivalScheduled,
      airline,
      aircraft: null,
      aircraftReg: item.aircraft?.reg ?? null,
      departureTerminal: item.departure.terminal ?? null,
      departureGate: item.departure.gate ?? null,
      arrivalTerminal: item.arrival.terminal ?? null,
      arrivalGate: item.arrival.gate ?? null,
      departureRunway: depTimes.runway,
      arrivalRunway: arrTimes.runway,
      taxiOut,
      taxiIn,
      airborneTime,
    };

    result.push(flightInfo);
  }

  return result;
}

export async function getAircraftFromReg(
  reg: string,
): Promise<Aircraft | null> {
  await rateLimiter.checkRequest();

  const resp = await fetchAeroDataBox(
    `/aircrafts/reg/${encodeURIComponent(reg)}`,
  );

  if (!resp.ok) {
    console.error('Failed to fetch aircraft data:', resp.statusText);
    return null;
  }

  if (resp.status === 204) {
    return null;
  }

  const data = (await resp.json()) as {
    model?: string;
    icaoCode?: string;
  } | null;

  for (const code of [data?.model, data?.icaoCode]) {
    if (!code) continue;

    const aircraft = await getAircraftByIcao(code);
    if (aircraft) return aircraft;
  }

  return null;
}
