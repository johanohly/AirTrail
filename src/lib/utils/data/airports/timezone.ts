import { find, setCache as setGeoTzCache } from 'geo-tz';

const GEO_TZ_IMPORT_CACHE_LIMIT = 128;

/**
 * Manual timezone overrides for airports where geo-tz returns incorrect results.
 * Key: ICAO code, Value: Correct IANA timezone
 *
 * OOL (Gold Coast): Located right on the Queensland/NSW border.
 * geo-tz returns Australia/Sydney (NSW, has DST) but it should be
 * Australia/Brisbane (Queensland, no DST) as the airport operates on QLD time.
 */
const TIMEZONE_OVERRIDES: Record<string, string> = {
  YBCG: 'Australia/Brisbane', // Gold Coast (OOL)
};

export const getAirportTimezone = (
  icao: string,
  latitude: number,
  longitude: number,
) => {
  return TIMEZONE_OVERRIDES[icao] ?? find(latitude, longitude)[0] ?? null;
};

export const withBoundedGeoTzCache = async <T>(work: () => Promise<T>) => {
  setGeoTzCache({ store: createBoundedGeoTzCache(GEO_TZ_IMPORT_CACHE_LIMIT) });

  try {
    return await work();
  } finally {
    setGeoTzCache();
  }
};

const createBoundedGeoTzCache = (limit: number) => {
  const store = new Map<string, unknown>();

  return {
    get(key: string) {
      if (!store.has(key)) {
        return undefined;
      }

      const value = store.get(key);
      store.delete(key);
      if (value !== undefined) {
        store.set(key, value);
      }
      return value;
    },
    set(key: string, value: unknown) {
      if (store.has(key)) {
        store.delete(key);
      }

      store.set(key, value);

      if (store.size > limit) {
        const oldestKey = store.keys().next().value;
        if (oldestKey !== undefined) {
          store.delete(oldestKey);
        }
      }
    },
  };
};
