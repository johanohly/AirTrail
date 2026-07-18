import { z } from 'zod';

import { db } from '$lib/db';
import { authedProcedure, router } from '$lib/server/trpc';

export const runwayRouter = router({
  getByAirport: authedProcedure.input(z.number()).query(async ({ input }) => {
    return await db
      .selectFrom('runway')
      .select(['id', 'leIdent', 'heIdent'])
      .where('airportId', '=', input)
      .where('closed', '=', false)
      .orderBy('leIdent')
      .execute();
  }),
});
