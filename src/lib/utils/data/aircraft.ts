import { AIRCRAFT } from '$lib/data/aircraft';
import type { FlightData } from '$lib/utils';

export type Aircraft = (typeof AIRCRAFT)[number];


export const aircraftFromICAO = (icao: string): Aircraft | null => {
  return AIRCRAFT.find((aircraft) => aircraft.icao === icao) ?? null;
};

export const formatAircraft = (flight: FlightData) => {
  return flight.aircraft && flight.aircraftReg
    ? `${flight.aircraft} (${flight.aircraftReg})`
    : flight.aircraft || flight.aircraftReg || 'Unknown';
};
