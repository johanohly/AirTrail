import type { FlightData } from '$lib/utils';

export const formatAircraft = (flight: FlightData) => {
  return flight.aircraft && flight.aircraftReg
    ? `${flight.aircraft} (${flight.aircraftReg})`
    : flight.aircraft || flight.aircraftReg || 'Unknown';
};
