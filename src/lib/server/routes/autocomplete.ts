import { authedProcedure, router } from '$lib/server/trpc';
import { AIRPORTS } from '$lib/data/airports';
import type { Airport } from '$lib/utils/data/data';
import { z } from 'zod';
import { AIRLINES } from '$lib/data/airlines';

const eq = (a: string | number, b: string | number) => {
  a = String(a);
  b = String(b);
  return a.toLowerCase() === b.toLowerCase();
};

export const autocompleteRouter = router({
  airport: authedProcedure
    .input(z.string())
    .query(async ({ input }): Promise<Airport[]> => {
      let results = AIRPORTS.filter((airport) => {
        const matchesCode =
          (input.length === 3 && eq(airport.IATA, input)) ||
          (input.length === 4 && eq(airport.ICAO, input));
        const matchesName = airport.name
          .toLowerCase()
          .includes(input.toLowerCase());

        return matchesCode || matchesName;
      });

      results = results.sort((a, b) => b.tier - a.tier).slice(0, 10);

      return results;
    }),
  airline: authedProcedure
    .input(z.string())
    .query(async ({ input }): Promise<(typeof AIRLINES)[0][]> => {
      return AIRLINES.filter((airline) => {
        return (
          eq(airline.icao, input) ||
          airline.name.toLowerCase().includes(input.toLowerCase())
        );
      });
    }),
});
