import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
  authedProcedure,
  permissionProcedure,
  publicProcedure,
  router,
} from '../trpc';

import { db } from '$lib/db';
import { appConfig } from '$lib/server/utils/config';
import {
  discoverOAuthClient,
  getAuthorizeUrl,
  OAuthConfigurationError,
  OAUTH_CODE_VERIFIER_COOKIE,
  OAUTH_STATE_COOKIE,
} from '$lib/server/utils/oauth';
import { oauthConfigSchema } from '$lib/zod/config';

export const oauthRouter = router({
  testConfiguration: permissionProcedure('instance.oauth.manage')
    .input(oauthConfigSchema)
    .mutation(async ({ input }) => {
      const currentConfig = await appConfig.get();
      if (!currentConfig) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Could not load the current OAuth configuration.',
        });
      }
      try {
        const client = await discoverOAuthClient({
          ...input,
          clientSecret: input.clientSecret || currentConfig.oauth.clientSecret,
        });
        const metadata = client.serverMetadata();
        return {
          issuer: metadata.issuer,
          authorizationEndpoint: metadata.authorization_endpoint ?? null,
          tokenEndpoint: metadata.token_endpoint ?? null,
          supportsPkce: metadata.supportsPKCE(),
        };
      } catch (error) {
        if (error instanceof OAuthConfigurationError) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
        }
        throw error;
      }
    }),
  authorize: publicProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const config = await appConfig.get();
      if (!config?.oauth?.enabled) {
        throw new Error('OAuth is not enabled');
      }

      const { codeVerifier, state, url } = await getAuthorizeUrl(input);
      const secure = ctx.url.protocol === 'https:';
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
