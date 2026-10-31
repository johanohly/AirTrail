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

const sameCode = (a: string | null, b: string) =>
  a?.replace(/\*$/, '').toUpperCase() === b.replace(/\*$/, '').toUpperCase();

/*
 * ICAO codes of defunct airlines get reassigned (Air Berlin's BER now belongs
 * to Fly Air41), so an ICAO match alone can silently file old flights under
 * the wrong airline. When the source also gives an IATA code, only accept an
 * airline whose IATA code agrees, or whose name matches since many airlines
 * have no IATA code in our data. Otherwise return null so the import asks the
 * user to map the airline.
 */
export async function getAirlineByCodes(
  icao: string,
  iata: string | null,
  name?: string | null,
): Promise<Airline | null> {
  if (!iata) return await getAirlineByIcao(icao);

  const byIata = await getAirlineByIata(iata);
  if (byIata && sameCode(byIata.icao, icao)) return byIata;

  const byIcao = await getAirlineByIcao(icao);
  if (!byIcao) return null;
  if (sameCode(byIcao.iata, iata)) return byIcao;
  if (name && byIcao.name.toLowerCase() === name.trim().toLowerCase()) {
    return byIcao;
  }
  return null;
}

export function clearAirlineLookupCaches() {
  airlineByIcaoCache.clear();
  airlineByIataCache.clear();
  airlineByNameCache.clear();
}
