import type { TZDate } from '@date-fns/tz';

import { getFlightRoute as getAdsbdbFlightRoute } from './adsbdb';
import { getFlightRoute as getAerodataboxFlightRoute } from './aerodatabox';

import type { Airport } from '$lib/db/types';
import { appConfig } from '$lib/server/utils/config';
import type { Airline } from '$lib/utils/data/airlines';

export type FlightLookupOptions = {
  date?: Date;
};

export type FlightLookupResultItem = {
  from: Airport;
  to: Airport;
  departure: TZDate | null;
  arrival: TZDate | null;
  airline: Airline | null;
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
