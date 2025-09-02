import { z } from 'zod';

import { db } from '$lib/db';
import { adminProcedure, authedProcedure, router } from '$lib/server/trpc';
import {
  getAircraft,
  getAircraftByIcao,
  getAircraftByName,
} from '$lib/server/utils/aircraft';

export const aircraftRouter = router({
  get: authedProcedure.input(z.number()).query(async ({ input }) => {
    return await getAircraft(input);
  }),
  getByIcao: authedProcedure.input(z.string()).query(async ({ input }) => {
    return await getAircraftByIcao(input);
  }),
  getByName: authedProcedure.input(z.string()).query(async ({ input }) => {
    return await getAircraftByName(input);
  }),
  list: authedProcedure.query(async () => {
    return await db
      .selectFrom('aircraft')
      .selectAll()
      .orderBy('name')
      .execute();
  }),
  delete: adminProcedure.input(z.number()).mutation(async ({ input }) => {
    const result = await db
      .deleteFrom('aircraft')
      .where('id', '=', input)
      .execute();
    return result.length > 0;
  }),
});
