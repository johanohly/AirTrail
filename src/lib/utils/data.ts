import { AIRPORTS } from "$lib/data/airports";

export const findByIata = (iata: string): typeof AIRPORTS[0] | undefined => {
  return AIRPORTS.find((airport) => airport.iata === iata);
};
