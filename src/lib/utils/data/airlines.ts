import { LRUCache } from 'lru-cache';

import type { Airline } from '$lib/db/types';
import { api } from '$lib/trpc';
import { type CacheEntry, notFound, unwrap } from '$lib/utils/data/cache-utils';

const cacheOptions = {
  max: 100,
};
export const airlineSearchCache = new LRUCache<string, Airline[]>(cacheOptions);

const lookupCacheOptions = {
  max: 500,
};
const airlineByIcaoCache = new LRUCache<string, CacheEntry<Airline>>(
  lookupCacheOptions,
);
const airlineByIataCache = new LRUCache<string, CacheEntry<Airline>>(
  lookupCacheOptions,
);
const airlineByNameCache = new LRUCache<string, CacheEntry<Airline>>(
  lookupCacheOptions,
);

export async function getAirlineByIcao(icao: string): Promise<Airline | null> {
  const key = icao.toUpperCase();
  const cached = airlineByIcaoCache.get(key);
  if (cached !== undefined) return unwrap(cached);
  const result = (await api.airline.getByIcao.query(icao)) ?? null;
  airlineByIcaoCache.set(key, result ?? notFound);
  return result;
}

export async function getAirlineByIata(iata: string): Promise<Airline | null> {
  const key = iata.toUpperCase();
  const cached = airlineByIataCache.get(key);
  if (cached !== undefined) return unwrap(cached);
  const result = (await api.airline.getByIata.query(iata)) ?? null;
  airlineByIataCache.set(key, result ?? notFound);
  return result;
}

export async function getAirlineByName(name: string): Promise<Airline | null> {
  const key = name.toLowerCase();
  const cached = airlineByNameCache.get(key);
  if (cached !== undefined) return unwrap(cached);
  const result = (await api.airline.getByName.query(name)) ?? null;
  airlineByNameCache.set(key, result ?? notFound);
  return result;
}

export function clearAirlineLookupCaches() {
  airlineByIcaoCache.clear();
  airlineByIataCache.clear();
  airlineByNameCache.clear();
}
