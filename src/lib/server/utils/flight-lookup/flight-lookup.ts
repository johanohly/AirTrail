import type { TZDate } from '@date-fns/tz';

import { getFlightRoute as getAdsbdbFlightRoute } from './adsbdb';
import { getFlightRoute as getAerodataboxFlightRoute } from './aerodatabox';

import type { Airport, Aircraft, Airline } from '$lib/db/types';
import { appConfig } from '$lib/server/utils/config';

export type FlightLookupOptions = {
  date?: Date;
  /** ICAO or IATA code of the departure airport, used to narrow down results. */
  from?: string;
  /** ICAO or IATA code of the arrival airport, used to narrow down results. */
  to?: string;
};

export type FlightLookupResultItem = {
  from: Airport;
  to: Airport;
  departure?: TZDate | null;
  arrival?: TZDate | null;
  departureScheduled?: TZDate | null;
  arrivalScheduled?: TZDate | null;
  airline?: Airline | null;
  aircraft?: Aircraft | null;
  aircraftReg?: string | null;
  departureTerminal?: string | null;
  departureGate?: string | null;
  arrivalTerminal?: string | null;
  arrivalGate?: string | null;
};

export type FlightLookupResult = FlightLookupResultItem[];

interface FlightLookupProvider {
  getFlightRoute: (
    flightNumber: string,
    opts?: FlightLookupOptions,
  ) => Promise<FlightLookupResult>;
}

const aerodataboxProvider: FlightLookupProvider = {
  getFlightRoute: getAerodataboxFlightRoute,
};

const adsbdbProvider: FlightLookupProvider = {
  getFlightRoute: (flightNumber: string) => getAdsbdbFlightRoute(flightNumber),
};

async function getProvider(): Promise<FlightLookupProvider> {
  const config = await appConfig.get();
  const apiKey = config?.integrations?.aeroDataBoxKey;
  if (apiKey && apiKey.trim().length > 0) return aerodataboxProvider;
  return adsbdbProvider;
}

function matchesAirport(airport: Airport, code: string | undefined): boolean {
  const wanted = code?.trim().toUpperCase();
  if (!wanted) return true;

  return (
    airport.icao.toUpperCase() === wanted ||
    airport.iata?.toUpperCase() === wanted
  );
}

/**
 * Narrows results down to the route the user already entered. The same flight
 * number is often used for both legs on a given date, so without this the user
 * would be asked to pick between a flight and its reverse.
 */
function filterByRoute(
  results: FlightLookupResult,
  opts?: FlightLookupOptions,
): FlightLookupResult {
  if (!opts?.from && !opts?.to) return results;

  const filtered = results.filter(
    (r) => matchesAirport(r.from, opts.from) && matchesAirport(r.to, opts.to),
  );

  // If nothing matches, the entered route is likely wrong. Fall back to the
  // full set instead of claiming the flight doesn't exist.
  return filtered.length > 0 ? filtered : results;
}

export async function getFlightRoute(
  flightNumber: string,
  opts?: FlightLookupOptions,
): Promise<FlightLookupResult> {
  const provider = await getProvider();
  const results = await provider.getFlightRoute(flightNumber, opts);
  return filterByRoute(results, opts);
}
