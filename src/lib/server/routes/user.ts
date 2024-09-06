import {
  adminProcedure,
  authedProcedure,
  publicProcedure,
  router,
} from '../trpc';
import { db } from '$lib/db';
import { sql } from 'kysely';
import { z } from 'zod';

export const userRouter = router({
  me: authedProcedure.query(({ ctx: { user } }) => {
    return user;
  }),
  isSetup: publicProcedure.query(async () => {
    const users = await db
      .selectFrom('user')
      .select(sql`1`.as('exists'))
      .limit(1)
      .execute();
    return users.length > 0;
  }),
  delete: adminProcedure.input(z.string()).mutation(async ({ input }) => {
    const result = await db
      .deleteFrom('user')
      .where('id', '=', input)
      .executeTakeFirst();
    return result.numDeletedRows > 0;
  }),
  list: adminProcedure.query(async () => {
    return db.selectFrom('user').selectAll('user').execute();
  }),
});
