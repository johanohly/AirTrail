import { z } from 'zod';

import { db } from '$lib/db';
import { adminProcedure, authedProcedure, router } from '$lib/server/trpc';
import {
  getAirline,
  getAirlineByIcao,
  getAirlineByName,
  populateDefaultAirlineIcons,
} from '$lib/server/utils/airline';

export const airlineRouter = router({
  get: authedProcedure.input(z.number()).query(async ({ input }) => {
    return await getAirline(input);
  }),
  getByIcao: authedProcedure.input(z.string()).query(async ({ input }) => {
    return await getAirlineByIcao(input);
  }),
  getByIata: authedProcedure.input(z.string()).query(async ({ input }) => {
    return await db
      .selectFrom('airline')
      .selectAll()
      .where('iata', 'ilike', input)
      .executeTakeFirst();
  }),
  getByName: authedProcedure.input(z.string()).query(async ({ input }) => {
    return await getAirlineByName(input);
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
  importDefaultIcons: adminProcedure
    .input(z.object({ overwrite: z.boolean() }))
    .mutation(async ({ input }) => {
      return await populateDefaultAirlineIcons({ overwrite: input.overwrite });
    }),
});
