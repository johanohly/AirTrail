import { authedProcedure, publicProcedure, router } from '../trpc';
import { getOAuthClient } from '$lib/server/utils/oauth';
import { z } from 'zod';
import { generators } from 'openid-client';
import { db } from '$lib/db';
import { appConfig } from '$lib/server/utils/config';

export const oauthRouter = router({
  authorize: publicProcedure.input(z.string()).query(async ({ input }) => {
    const config = await appConfig.get();
    if (!config?.oauth?.enabled) {
      throw new Error('OAuth is not enabled');
    }

    const client = await getOAuthClient();
    const url = client.authorizationUrl({
      redirect_uri: input,
      scope: config.oauth.scope,
      state: generators.state(),
    });

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
