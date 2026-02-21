import { tz } from '@date-fns/tz';
import {
  differenceInCalendarDays,
  format,
  isValid,
  parse,
  subDays,
  addDays,
} from 'date-fns';

import type { FlightLookupOptions, FlightLookupResult } from './flight-lookup';

import type { Aircraft, Airline } from '$lib/db/types';
import { getAircraftByIcao } from '$lib/server/utils/aircraft';
import { getAirlineByIcao, getAirlineByIata } from '$lib/server/utils/airline';
import { getAirportByIcao } from '$lib/server/utils/airport';
import { appConfig } from '$lib/server/utils/config';
import { RequestRateLimiter } from '$lib/utils/ratelimiter';

const BASE_URL = 'https://aerodatabox.p.rapidapi.com';
const rateLimiter = new RequestRateLimiter();

function sanitizeFlightNumber(fn: string): string {
  // Remove spaces and dashes, uppercase (e.g., "SK 728" -> "SK728")
  return fn.replace(/\s|-/g, '').toUpperCase();
}

function isValidDateWithin365(date: Date): boolean {
  if (!isValid(date)) return false;
  const diff = Math.abs(differenceInCalendarDays(date, new Date()));
  return diff <= 365;
}

export async function getFlightRoute(
  flightNumber: string,
  opts?: FlightLookupOptions,
): Promise<FlightLookupResult> {
  await rateLimiter.checkRequest();

  const config = await appConfig.get();
  const apiKey = config?.integrations?.aeroDataBoxKey ?? null;
  if (!apiKey) {
    throw new Error('AeroDataBox API key not configured');
  }

  const cleaned = sanitizeFlightNumber(flightNumber);

  const date = opts?.date;
  if (date && !isValidDateWithin365(date)) {
    throw new Error('Date must be within 365 days of today');
  }

  let url: string;
  if (date) {
    url = `${BASE_URL}/flights/number/${encodeURIComponent(
      cleaned,
    )}/${format(date, 'yyyy-MM-dd')}?dateLocalRole=Both&withAircraftImage=false&withLocation=false`;
  } else {
    const now = new Date();
    const fromDate = format(subDays(now, 2), 'yyyy-MM-dd');
    const toDate = format(addDays(now, 2), 'yyyy-MM-dd');
    url = `${BASE_URL}/flights/number/${encodeURIComponent(
      cleaned,
    )}/${fromDate}/${toDate}?dateLocalRole=Both&withAircraftImage=false&withLocation=false`;
  }

  const resp = await fetch(url, {
    headers: {
      'x-rapidapi-key': apiKey,
    },
  });

  if (resp.status === 204) {
    throw new Error('No matching flights found');
  }
  if (!resp.ok) {
    console.error('Failed to fetch flight data:', resp.statusText);
    throw new Error('Failed to fetch flight data');
  }

  type AedbxFlight = {
    departure: {
      airport: { icao?: string; timeZone?: string };
      terminal?: string;
      gate?: string;
      scheduledTime?: { local: string };
      revisedTime?: { local: string };
      actualTime?: { local: string };
    };
    arrival: {
      airport: { icao?: string; timeZone?: string };
      terminal?: string;
      gate?: string;
      scheduledTime?: { local: string };
      revisedTime?: { local: string };
      actualTime?: { local: string };
    };
    airline?: { iata?: string; icao?: string };
    aircraft?: { reg?: string };
  };

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

    const parseTime = (timeStr: string | undefined, tzId: string) => {
      if (!timeStr) return null;
      return parse(timeStr, 'yyyy-MM-dd HH:mmxxx', new Date(), {
        in: tz(tzId),
      });
    };

    const depTz = item.departure.airport.timeZone ?? fromAirport.tz;
    const arrTz = item.arrival.airport.timeZone ?? toAirport.tz;

    // Actual time (best estimate of what actually happened)
    const departureTimeStr =
      item.departure.actualTime?.local ??
      item.departure.revisedTime?.local ??
      item.departure.scheduledTime?.local;
    const arrivalTimeStr =
      item.arrival.actualTime?.local ??
      item.arrival.revisedTime?.local ??
      item.arrival.scheduledTime?.local;

    const departureTime = parseTime(departureTimeStr, depTz);
    const arrivalTime = parseTime(arrivalTimeStr, arrTz);

    // Scheduled time
    const departureScheduled = parseTime(
      item.departure.scheduledTime?.local,
      depTz,
    );
    const arrivalScheduled = parseTime(
      item.arrival.scheduledTime?.local,
      arrTz,
    );

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
      aircraft: item.aircraft?.reg
        ? await getAircraftFromReg(item.aircraft.reg)
        : null,
      aircraftReg: item.aircraft?.reg ?? null,
      departureTerminal: item.departure.terminal ?? null,
      departureGate: item.departure.gate ?? null,
      arrivalTerminal: item.arrival.terminal ?? null,
      arrivalGate: item.arrival.gate ?? null,
    };

    result.push(flightInfo);
  }

  return result;
}

async function getAircraftFromReg(reg: string): Promise<Aircraft | null> {
  const config = await appConfig.get();
  const apiKey = config?.integrations?.aeroDataBoxKey ?? null;
  if (!apiKey) {
    throw new Error('AeroDataBox API key not configured');
  }

  const url = `${BASE_URL}/aircrafts/reg/${encodeURIComponent(reg)}`;
  const resp = await fetch(url, {
    headers: {
      'x-rapidapi-key': apiKey,
    },
  });

  if (!resp.ok) {
    console.error('Failed to fetch aircraft data:', resp.statusText);
    return null;
  }

  if (resp.status === 204) {
    return null;
  }

  const data = await resp.json();
  if (!data || !data?.icaoCode) {
    return null;
  }

  return await getAircraftByIcao(data.icaoCode);
}
