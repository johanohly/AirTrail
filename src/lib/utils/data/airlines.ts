import { AIRLINE_TRANSITIONS, AIRLINES } from '$lib/data/airlines';

export type Airline = (typeof AIRLINES)[number];

export const airlineFromICAO = (icao: string): Airline | null => {
  const transition = AIRLINE_TRANSITIONS[icao];
  if (transition) {
    return airlineFromICAO(transition);
  }

  return AIRLINES.find((airline) => airline.icao === icao) ?? null;
};
