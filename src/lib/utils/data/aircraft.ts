import { LRUCache } from 'lru-cache';

import type { Aircraft } from '$lib/db/types';
import { api } from '$lib/trpc';
import type { FlightData } from '$lib/utils';
import { type CacheEntry, notFound, unwrap } from '$lib/utils/data/cache-utils';

export const formatAircraft = (flight: FlightData) => {
  const aircraft = flight.aircraft?.name;
  return aircraft && flight.aircraftReg
    ? `${aircraft} (${flight.aircraftReg})`
    : aircraft || flight.aircraftReg || 'Unknown';
};

const cacheOptions = {
  max: 100,
};
export const aircraftSearchCache = new LRUCache<string, Aircraft[]>(
  cacheOptions,
);

const lookupCacheOptions = {
  max: 500,
};
const aircraftByIcaoCache = new LRUCache<string, CacheEntry<Aircraft>>(
  lookupCacheOptions,
);
const aircraftByNameCache = new LRUCache<string, CacheEntry<Aircraft>>(
  lookupCacheOptions,
);

export async function getAircraftByIcao(
  icao: string,
): Promise<Aircraft | null> {
  const key = icao.toUpperCase();
  const cached = aircraftByIcaoCache.get(key);
  if (cached !== undefined) return unwrap(cached);
  const result = (await api.aircraft.getByIcao.query(icao)) ?? null;
  aircraftByIcaoCache.set(key, result ?? notFound);
  return result;
}

export async function getAircraftByName(
  name: string,
): Promise<Aircraft | null> {
  const key = name.toLowerCase();
  const cached = aircraftByNameCache.get(key);
  if (cached !== undefined) return unwrap(cached);
  const result = (await api.aircraft.getByName.query(name)) ?? null;
  aircraftByNameCache.set(key, result ?? notFound);
  return result;
}

export function clearAircraftLookupCaches() {
  aircraftByIcaoCache.clear();
  aircraftByNameCache.clear();
}
