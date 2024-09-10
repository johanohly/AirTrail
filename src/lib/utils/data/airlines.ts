import { AIRLINES } from '$lib/data/airlines';

export type Airline = (typeof AIRLINES)[number];

export const airlineFromICAO = (icao: string): Airline | null => {
  return AIRLINES.find((airline) => airline.icao === icao) ?? null;
};
