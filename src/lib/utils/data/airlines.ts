import { AIRLINES } from '$lib/data/airlines';
import { AIRLINE_TRANSITIONS } from '$lib/data/transitions';

export type Airline = (typeof AIRLINES)[number];

export const airlineFromICAO = (icao: string): Airline | null => {
  const transition = AIRLINE_TRANSITIONS[icao];
  if (transition) {
    return airlineFromICAO(transition);
  }

  return AIRLINES.find((airline) => airline.icao === icao) ?? null;
};
