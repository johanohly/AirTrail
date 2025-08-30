import { LRUCache } from 'lru-cache';

import type { Airline } from '$lib/db/types';

const cacheOptions = {
  max: 100,
};
export const airlineSearchCache = new LRUCache<string, Airline[]>(cacheOptions);
