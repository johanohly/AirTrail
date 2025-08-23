import { z } from 'zod';

import type { Aircraft, Airline, Airport } from '$lib/db/types';
import { authedProcedure, router } from '$lib/server/trpc';
import { findAircraft } from '$lib/server/utils/aircraft';
import { findAirline } from '$lib/server/utils/airline';
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
  aircraft: authedProcedure
    .input(z.string())
    .query(async ({ input }): Promise<Aircraft[]> => {
      return (await findAircraft(input)) ?? [];
    }),
  airline: authedProcedure
    .input(z.string())
    .query(async ({ input }): Promise<Airline[]> => {
      return (await findAirline(input)) ?? [];
    }),
});
