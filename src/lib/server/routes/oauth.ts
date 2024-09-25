import { publicProcedure, router } from '../trpc';
import { fetchAppConfig } from '$lib/server/utils/config';
import { getOAuthClient } from '$lib/server/utils/oauth';
import { z } from 'zod';
import { generators } from 'openid-client';

export const oauthRouter = router({
  authorize: publicProcedure.input(z.string()).query(async ({ input }) => {
    const config = await fetchAppConfig();
    if (!config?.enabled) {
      throw new Error('OAuth is not enabled');
    }

    const client = await getOAuthClient();
    const url = client.authorizationUrl({
      redirect_uri: input,
      scope: config.scope,
      state: generators.state(),
    });

    return { url };
  }),
});
