import { z } from 'zod';

import { AIRLINES } from '$lib/data/airlines';
import { AIRPORTS } from '$lib/data/airports';
import { authedProcedure, router } from '$lib/server/trpc';
import { sortAndFilterByMatch } from '$lib/utils';
import type { Airport } from '$lib/utils/data/legacy_airports';

const eq = (a: string | number, b: string | number) => {
  a = String(a);
  b = String(b);
  return a.toLowerCase() === b.toLowerCase();
};

export const autocompleteRouter = router({
  airport: authedProcedure
    .input(z.string())
    .query(async ({ input }): Promise<Airport[]> => {
      return sortAndFilterByMatch(
        AIRPORTS,
        input,
        [
          { key: 'name' },
          { key: 'IATA', exact: true },
          { key: 'ICAO', exact: true },
        ],
        (a, b) => b.tier - a.tier,
        10,
      );
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
