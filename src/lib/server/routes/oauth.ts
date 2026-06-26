import { z } from 'zod';

import { authedProcedure, publicProcedure, router } from '../trpc';

import { db } from '$lib/db';
import { appConfig } from '$lib/server/utils/config';
import {
  getAuthorizeUrl,
  OAUTH_CODE_VERIFIER_COOKIE,
  OAUTH_STATE_COOKIE,
} from '$lib/server/utils/oauth';

export const oauthRouter = router({
  authorize: publicProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const config = await appConfig.get();
      if (!config?.oauth?.enabled) {
        throw new Error('OAuth is not enabled');
      }

      const { codeVerifier, state, url } = await getAuthorizeUrl(input);
      const secure = input.startsWith('https://');
      const cookieOptions = {
        httpOnly: true,
        maxAge: 10 * 60,
        path: '/',
        sameSite: 'lax' as const,
        secure,
      };
      ctx.cookies.set(OAUTH_STATE_COOKIE, state, cookieOptions);
      ctx.cookies.set(OAUTH_CODE_VERIFIER_COOKIE, codeVerifier, cookieOptions);

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
