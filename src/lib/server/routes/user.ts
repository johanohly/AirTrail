import { TRPCError } from '@trpc/server';
import { sql } from 'kysely';
import { z } from 'zod';

import {
  adminProcedure,
  authedProcedure,
  publicProcedure,
  router,
} from '../trpc';

import { db } from '$lib/db';
import { createApiKey } from '$lib/server/utils/auth';

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
  delete: authedProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    if (ctx.user.id !== input && ctx.user.role === 'user') {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }

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
      (ctx.user.role === 'admin' &&
        user.role !== 'user' &&
        ctx.user.id !== user.id)
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
    return db.selectFrom('user').selectAll().execute();
  }),
  listApiKeys: authedProcedure.query(async ({ ctx }) => {
    return db
      .selectFrom('apiKey')
      .select(['id', 'name', 'createdAt', 'lastUsed'])
      .where('userId', '=', ctx.user.id)
      .execute();
  }),
  createApiKey: authedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      return await createApiKey(ctx.user.id, input);
    }),
});
