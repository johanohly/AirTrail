import { AIRPORTS } from "$lib/data/airports";
import { distanceBetween } from "$lib/utils/distance";
import type { APIFlight } from "$lib/db";

export const prepareFlightData = (data: APIFlight[]) => {
  if (!data) return [];

  return data.map((flight) => {
    const fromAirport = findByIata(flight.from);
    const toAirport = findByIata(flight.to);
    if (!fromAirport || !toAirport) return null;

    return {
      id: flight.id,
      distance: distanceBetween([fromAirport.lon, fromAirport.lat], [toAirport.lon, toAirport.lat]) / 1000,
      from: [fromAirport.lon, fromAirport.lat],
      to: [toAirport.lon, toAirport.lat],
      fromName: fromAirport.name,
      toName: toAirport.name
    };
  });
};

export const findByIata = (iata: string): typeof AIRPORTS[0] | undefined => {
  return AIRPORTS.find((airport) => airport.iata === iata);
};
