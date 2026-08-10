import type { TZDate } from '@date-fns/tz';

import { getFlightRoute as getAdsbdbFlightRoute } from './adsbdb';
import { getFlightRoute as getAerodataboxFlightRoute } from './aerodatabox';

import type { Airport, Aircraft, Airline } from '$lib/db/types';
import { appConfig } from '$lib/server/utils/config';

export type FlightLookupProviderOptions = {
  date?: Date;
};

export type FlightRoutePreference = {
  /** ICAO or IATA code of the preferred departure airport. */
  from?: string;
  /** ICAO or IATA code of the preferred arrival airport. */
  to?: string;
};

export type FlightLookupOptions = FlightLookupProviderOptions & {
  preferredRoute?: FlightRoutePreference;
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
    opts?: FlightLookupProviderOptions,
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

/** Prefer route matches, but preserve every result when none match. */
export function preferRouteMatches(
  results: FlightLookupResult,
  preferredRoute?: FlightRoutePreference,
): FlightLookupResult {
  if (!preferredRoute?.from && !preferredRoute?.to) return results;

  const matches = results.filter(
    (result) =>
      matchesAirport(result.from, preferredRoute.from) &&
      matchesAirport(result.to, preferredRoute.to),
  );

  return matches.length > 0 ? matches : results;
}

export async function getFlightRoute(
  flightNumber: string,
  opts?: FlightLookupOptions,
): Promise<FlightLookupResult> {
  const provider = await getProvider();
  const providerOptions = opts?.date ? { date: opts.date } : undefined;
  const results = await provider.getFlightRoute(flightNumber, providerOptions);
  return preferRouteMatches(results, opts?.preferredRoute);
}
