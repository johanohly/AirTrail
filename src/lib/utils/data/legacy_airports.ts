import { LRUCache } from 'lru-cache';

import { AIRPORTS } from '$lib/data/airports';
import { AIRPORT_TRANSITIONS } from '$lib/data/transitions';

export type Airport = {
  name: string;
  country: string;
  continent: string;
  tz: string;
  lat: number;
  lon: number;
  IATA: string | null;
  ICAO: string;
  wiki: string | null;
};

export const airportFromICAO = (icao: string): Airport | undefined => {
  const transition = AIRPORT_TRANSITIONS[icao];
  if (transition) {
    return airportFromICAO(transition);
  }

  return AIRPORTS.find((airport) => airport.ICAO === icao);
};

export const airportFromIATA = (iata: string): Airport | undefined => {
  return AIRPORTS.find((airport) => airport.IATA === iata);
};

const cacheOptions = {
  max: 100,
};
export const airportSearchCache = new LRUCache<string, Airport[]>(cacheOptions);
