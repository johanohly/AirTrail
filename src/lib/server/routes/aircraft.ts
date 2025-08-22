import { z } from 'zod';

import { db } from '$lib/db';
import { adminProcedure, authedProcedure, router } from '$lib/server/trpc';

export const aircraftRouter = router({
  get: authedProcedure.input(z.string()).query(async ({ input }) => {
    return await db
      .selectFrom('aircraft')
      .selectAll()
      .where('icao', '=', input)
      .executeTakeFirst();
  }),
  list: authedProcedure.query(async () => {
    return await db
      .selectFrom('aircraft')
      .selectAll()
      .orderBy('name')
      .execute();
  }),
  getData: authedProcedure.query(async () => {
    const numAircraft = await db
      .selectFrom('aircraft')
      .select((eb) => eb.fn.count('aircraft.icao').as('count'))
      .executeTakeFirst();

    const allAircraft = await db
      .selectFrom('aircraft')
      .selectAll()
      .orderBy('name')
      .execute();

    return {
      numAircraft: Number(numAircraft?.count ?? 0),
      aircraft: allAircraft,
    };
  }),
  delete: adminProcedure.input(z.string()).mutation(async ({ input }) => {
    const result = await db
      .deleteFrom('aircraft')
      .where('icao', '=', input)
      .execute();
    return result.length > 0;
  }),
});