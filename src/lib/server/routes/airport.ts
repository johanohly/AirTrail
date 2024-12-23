import { z } from 'zod';

import { db } from '$lib/db';
import type { Airport } from '$lib/db/types';
import { authedProcedure, router } from '$lib/server/trpc';

export const airportRouter = router({
  get: authedProcedure
    .input(z.string())
    .query(async ({ input }): Promise<Airport | null> => {
      return (
        (await db
          .selectFrom('airport')
          .selectAll()
          .where('code', 'ilike', input)
          .executeTakeFirst()) ?? null
      );
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
