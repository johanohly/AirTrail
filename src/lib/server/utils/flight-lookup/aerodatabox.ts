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

import { getAirport } from '$lib/server/utils/airport';
import { appConfig } from '$lib/server/utils/config';
import { airlineFromICAO } from '$lib/utils/data/airlines';
import { RequestRateLimiter } from '$lib/utils/ratelimiter';

const BASE_URL = 'https://prod.api.market/api/v1/aedbx/aerodatabox';
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
  const apiKey = config?.flight?.apiMarketKey ?? null;
  if (!apiKey) {
    throw new Error('AeroDataBox API key not configured');
  }

  const cleaned = sanitizeFlightNumber(flightNumber);

  const date = opts?.date;
  console.log(date);
  if (date && !isValidDateWithin365(date)) {
    throw new Error('Date must be within 365 days of today');
  }

  let url: string;
  if (date) {
    url = `${BASE_URL}/flights/Number/${encodeURIComponent(
      cleaned,
    )}/${format(date, 'yyyy-MM-dd')}?dateLocalRole=Both&withAircraftImage=false&withLocation=false`;
  } else {
    const now = new Date();
    const fromDate = format(subDays(now, 2), 'yyyy-MM-dd');
    const toDate = format(addDays(now, 2), 'yyyy-MM-dd');
    url = `${BASE_URL}/flights/Number/${encodeURIComponent(
      cleaned,
    )}/${fromDate}/${toDate}?dateLocalRole=Both&withAircraftImage=false&withLocation=false`;
  }

  const resp = await fetch(url, {
    headers: {
      'x-api-market-key': apiKey,
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
      airport: { icao: string; timeZone: string };
      scheduledTime: { local: string };
      revisedTime?: { local: string };
    };
    arrival: {
      airport: { icao: string; timeZone: string };
      scheduledTime: { local: string };
      revisedTime?: { local: string };
    };
    airline?: { icao?: string };
  };

  const data = (await resp.json()) as AedbxFlight[];
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('No matching flights found (2)');
  }

  const result: FlightLookupResult = [];
  for (const item of data) {
    const fromAirport = await getAirport(item.departure.airport.icao);
    const toAirport = await getAirport(item.arrival.airport.icao);

    if (!fromAirport || !toAirport) {
      continue;
    }

    const departureTime = parse(
      item.departure.revisedTime?.local ?? item.departure.scheduledTime.local,
      'yyyy-MM-dd HH:mmxxx',
      new Date(),
      { in: tz(item.departure.airport.timeZone) },
    );
    const arrivalTime = parse(
      item.arrival.revisedTime?.local ?? item.arrival.scheduledTime.local,
      'yyyy-MM-dd HH:mmxxx',
      new Date(),
      { in: tz(item.arrival.airport.timeZone) },
    );

    const flightInfo = {
      from: fromAirport,
      to: toAirport,
      departure: departureTime,
      arrival: arrivalTime,
      airline: item.airline?.icao ? airlineFromICAO(item.airline.icao) : null,
    };

    result.push(flightInfo);
  }

  return result;
}
