import { RequestRateLimiter } from '$lib/utils/ratelimiter';
import { getFlightRoute as getAdsbdbFlightRoute } from './adsbdb';
import { appConfig } from '$lib/server/utils/config';
import { differenceInCalendarDays, format, isValid, parse } from 'date-fns';

export type FlightLookupOptions = {
  // YYYY-MM-DD (local date of flight if known)
  date?: string;
};

export type FlightLookupResult = {
  origin: { icao_code: string };
  destination: { icao_code: string };
  airline: { icao: string };
};

interface FlightLookupProvider {
  getFlightRoute: (
    flightNumber: string,
    opts?: FlightLookupOptions,
  ) => Promise<FlightLookupResult>;
}

const rateLimiter = new RequestRateLimiter();

function sanitizeFlightNumber(fn: string): string {
  // Remove spaces and dashes, uppercase (e.g., "SK 728" -> "SK728")
  return fn.replace(/\s|-/g, '').toUpperCase();
}

function isValidDateWithin365(dateStr: string): boolean {
  const d = parse(dateStr, 'yyyy-MM-dd', new Date());
  if (!isValid(d)) return false;
  const diff = Math.abs(differenceInCalendarDays(d, new Date()));
  return diff <= 365;
}

async function getAeroDataBoxFlightRoute(
  flightNumber: string,
  opts?: FlightLookupOptions,
): Promise<FlightLookupResult> {
  await rateLimiter.checkRequest();

  const config = await appConfig.get();
  const apiKey = config?.flight?.apiMarketKey ?? null;
  if (!apiKey) {
    // Fallback decision is handled by the unified getter; this is a safeguard
    throw new Error('AeroDataBox API key not configured');
  }

  const cleaned = sanitizeFlightNumber(flightNumber);

  const date = opts?.date ?? format(new Date(), 'yyyy-MM-dd');
  if (!isValidDateWithin365(date)) {
    throw new Error('Date must be within 365 days of today');
  }

  const url = `https://prod.api.market/api/v1/aedbx/aerodatabox/flights/Number/${encodeURIComponent(
    cleaned,
  )}/${date}?dateLocalRole=Both&withAircraftImage=false&withLocation=false`;

  const resp = await fetch(url, {
    headers: {
      'x-api-market-key': apiKey,
    },
  });

  if (resp.status === 204) {
    throw new Error('Flight not found');
  }
  if (!resp.ok) {
    throw new Error('Flight not found');
  }

  type AedbxFlight = {
    codeshareStatus?: string;
    departure?: { airport?: { icao?: string } };
    arrival?: { airport?: { icao?: string } };
    airline?: { icao?: string };
  };

  const data = (await resp.json()) as AedbxFlight[];
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Flight not found');
  }

  // Prefer operator (non-codeshare) entries if present
  const entry =
    data.find((e) => e?.codeshareStatus === 'IsOperator') ?? data[0];

  const originIcao = entry?.departure?.airport?.icao;
  const destIcao = entry?.arrival?.airport?.icao;
  const airlineIcao = entry?.airline?.icao;

  if (!originIcao || !destIcao || !airlineIcao) {
    throw new Error('Flight not found');
  }

  return {
    origin: { icao_code: String(originIcao) },
    destination: { icao_code: String(destIcao) },
    airline: { icao: String(airlineIcao) },
  };
}

const aerodataboxProvider: FlightLookupProvider = {
  getFlightRoute: getAeroDataBoxFlightRoute,
};

const adsbdbProvider: FlightLookupProvider = {
  getFlightRoute: (flightNumber: string) => getAdsbdbFlightRoute(flightNumber),
};

async function getProvider(): Promise<FlightLookupProvider> {
  const config = await appConfig.get();
  const apiKey = config?.flight?.apiMarketKey;
  if (apiKey && apiKey.trim().length > 0) return aerodataboxProvider;
  return adsbdbProvider;
}

export async function getFlightRoute(
  flightNumber: string,
  opts?: FlightLookupOptions,
): Promise<FlightLookupResult> {
  const provider = await getProvider();
  return provider.getFlightRoute(flightNumber, opts);
}
