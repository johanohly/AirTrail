import { LRUCache } from 'lru-cache';

import type { Airport } from '$lib/db/types';

const cacheOptions = {
  max: 100,
};
export const airportSearchCache = new LRUCache<string, Airport[]>(cacheOptions);
