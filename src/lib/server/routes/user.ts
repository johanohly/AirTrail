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
  delete: adminProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    const user = await db
      .selectFrom('user')
      .selectAll()
      .where('id', '=', input)
      .executeTakeFirst();
    if (!user) {
      return false;
    }

    // Only allow deleting users if the user is an owner or the user is an admin and the user is not an admin or owner
    if (
      user.role === 'owner' ||
      (ctx.user.role === 'admin' && user.role !== 'user')
    ) {
      return false;
    }

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
