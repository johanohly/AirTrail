import { z } from 'zod';

import { db } from '$lib/db';
import { adminProcedure, authedProcedure, router } from '$lib/server/trpc';
import { getAirport } from '$lib/server/utils/airport';
import { updateAirports } from '$lib/utils/data/airports/source';

export const airportRouter = router({
  get: authedProcedure.input(z.string()).query(async ({ input }) => {
    return await getAirport(input);
  }),
  getFromIATA: authedProcedure.input(z.string()).query(async ({ input }) => {
    return (
      (await db
        .selectFrom('airport')
        .selectAll()
        .where('iata', 'ilike', input)
        .executeTakeFirst()) ?? null
    );
  }),
  getData: authedProcedure.query(async () => {
    const numAirports = await db
      .selectFrom('airport')
      .select((eb) => eb.fn.count('airport.code').as('count'))
      .where('custom', '=', false)
      .executeTakeFirst();

    const customAirports = await db
      .selectFrom('airport')
      .selectAll()
      .where('custom', '=', true)
      .execute();

    return {
      numAirports: Number(numAirports?.count ?? 0),
      customAirports,
    };
  }),
  delete: adminProcedure.input(z.string()).mutation(async ({ input }) => {
    const result = await db
      .deleteFrom('airport')
      .where('code', '=', input)
      .execute();
    return result.length > 0;
  }),
  updateFromSource: adminProcedure.mutation(async () => {
    return await updateAirports();
  }),
});
