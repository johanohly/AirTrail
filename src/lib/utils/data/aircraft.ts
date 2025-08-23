import type { FlightData } from '$lib/utils';

export const formatAircraft = (flight: FlightData) => {
  const aircraft = flight.aircraft?.icao || flight.aircraft?.name;
  return aircraft && flight.aircraftReg
    ? `${aircraft} (${flight.aircraftReg})`
    : aircraft || flight.aircraftReg || 'Unknown';
};
