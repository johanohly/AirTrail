import { LRUCache } from 'lru-cache';

import type { Aircraft } from '$lib/db/types';
import type { FlightData } from '$lib/utils';

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
