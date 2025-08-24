import { z } from 'zod';

import { db } from '$lib/db';
import { adminProcedure, authedProcedure, router } from '$lib/server/trpc';

export const airlineRouter = router({
  get: authedProcedure.input(z.number()).query(async ({ input }) => {
    return await db
      .selectFrom('airline')
      .selectAll()
      .where('id', '=', input)
      .executeTakeFirst();
  }),
  getByIcao: authedProcedure.input(z.string()).query(async ({ input }) => {
    return await db
      .selectFrom('airline')
      .selectAll()
      .where('icao', 'ilike', input)
      .executeTakeFirst();
  }),
  getByIata: authedProcedure.input(z.string()).query(async ({ input }) => {
    return await db
      .selectFrom('airline')
      .selectAll()
      .where('iata', 'ilike', input)
      .executeTakeFirst();
  }),
  list: authedProcedure.query(async () => {
    return await db.selectFrom('airline').selectAll().orderBy('name').execute();
  }),
  delete: adminProcedure.input(z.number()).mutation(async ({ input }) => {
    const result = await db
      .deleteFrom('airline')
      .where('id', '=', input)
      .execute();
    return result.length > 0;
  }),
});
