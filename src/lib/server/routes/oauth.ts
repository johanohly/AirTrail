import { z } from 'zod';

import { authedProcedure, publicProcedure, router } from '../trpc';

import { db } from '$lib/db';
import { appConfig } from '$lib/server/utils/config';
import { getAuthorizeUrl } from '$lib/server/utils/oauth';

export const oauthRouter = router({
  authorize: publicProcedure.input(z.string()).query(async ({ input }) => {
    const config = await appConfig.get();
    if (!config?.oauth?.enabled) {
      throw new Error('OAuth is not enabled');
    }

    const url = await getAuthorizeUrl(input);

    return { url };
  }),
  unlink: authedProcedure.mutation(async ({ ctx }) => {
    const result = await db
      .updateTable('user')
      .set({ oauthId: null })
      .where('id', '=', ctx.user.id)
      .executeTakeFirst();
    return result.numUpdatedRows > 0;
  }),
});
