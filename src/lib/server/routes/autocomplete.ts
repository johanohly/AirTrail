import { z } from 'zod';

import { AIRLINES } from '$lib/data/airlines';
import type { Airport } from '$lib/db/types';
import { authedProcedure, router } from '$lib/server/trpc';
import { findAirports } from '$lib/server/utils/airport';

const eq = (a: string | number, b: string | number) => {
  a = String(a);
  b = String(b);
  return a.toLowerCase() === b.toLowerCase();
};

export const autocompleteRouter = router({
  airport: authedProcedure
    .input(z.string())
    .query(async ({ input }): Promise<Airport[]> => {
      return await findAirports(input);
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
