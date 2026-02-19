import { LRUCache } from 'lru-cache';

import type { Airport } from '$lib/db/types';
import { api } from '$lib/trpc';
import { type CacheEntry, notFound, unwrap } from '$lib/utils/data/cache-utils';

const cacheOptions = {
  max: 100,
};
export const airportSearchCache = new LRUCache<string, Airport[]>(cacheOptions);

const lookupCacheOptions = {
  max: 500,
};
const airportFromIcaoCache = new LRUCache<string, CacheEntry<Airport>>(
  lookupCacheOptions,
);
const airportFromIataCache = new LRUCache<string, CacheEntry<Airport>>(
  lookupCacheOptions,
);

export async function getAirportByIcao(icao: string): Promise<Airport | null> {
  const key = icao.toUpperCase();
  const cached = airportFromIcaoCache.get(key);
  if (cached !== undefined) return unwrap(cached);
  const result = (await api.airport.getFromIcao.query(icao)) ?? null;
  airportFromIcaoCache.set(key, result ?? notFound);
  return result;
}

export async function getAirportByIata(iata: string): Promise<Airport | null> {
  const key = iata.toUpperCase();
  const cached = airportFromIataCache.get(key);
  if (cached !== undefined) return unwrap(cached);
  const result = (await api.airport.getFromIata.query(iata)) ?? null;
  airportFromIataCache.set(key, result ?? notFound);
  return result;
}

export function clearAirportLookupCaches() {
  airportFromIcaoCache.clear();
  airportFromIataCache.clear();
}
