import { z } from 'zod';

import { db } from '$lib/db';
import type { Airport } from '$lib/db/types';
import { authedProcedure, router } from '$lib/server/trpc';
import { getAirport } from '$lib/server/utils/airport';

export const airportRouter = router({
  get: authedProcedure
    .input(z.string())
    .query(async ({ input }): Promise<Airport | null> => {
      return await getAirport(input);
    }),
  getFromIATA: authedProcedure
    .input(z.string())
    .query(async ({ input }): Promise<Airport | null> => {
      return (
        (await db
          .selectFrom('airport')
          .selectAll()
          .where('iata', 'ilike', input)
          .executeTakeFirst()) ?? null
      );
    }),
});
