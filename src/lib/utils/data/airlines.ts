import { AIRLINES } from '$lib/data/airlines';
import { AIRLINE_TRANSITIONS } from '$lib/data/transitions';
import { leq } from '$lib/utils';

export type Airline = (typeof AIRLINES)[number];

export const airlineFromICAO = (icao: string): Airline | null => {
  const transition = AIRLINE_TRANSITIONS[icao];
  if (transition) {
    return airlineFromICAO(transition);
  }

  return AIRLINES.find((airline) => leq(airline.icao, icao)) ?? null;
};

// Returns the FIRST airline with the given IATA code
// some IATA codes are shared by multiple airlines
export const airlineFromIATA = (iata: string): Airline | null => {
  return (
    AIRLINES.find((airline) => airline.iata && leq(airline.iata, iata)) ?? null
  );
};
