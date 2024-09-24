import { publicProcedure, router } from '../trpc';
import { fetchAppConfig } from '$lib/server/utils/config';
import { getOAuthClient, getOAuthProfile } from '$lib/server/utils/oauth';
import { z } from 'zod';
import { generators } from 'openid-client';
import { db } from '$lib/db';
import { generateId } from 'lucia';

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
  callback: publicProcedure.input(z.string()).query(async ({ input }) => {
    console.log(input);
    const config = await fetchAppConfig();
    if (!config) {
      throw new Error('OAuth is not enabled');
    }

    const profile = await getOAuthProfile(input);
    const { autoRegister } = config;

    let user = await db
      .selectFrom('user')
      .selectAll()
      .where('oauthId', '=', profile.sub)
      .executeTakeFirst();

    if (!user && profile.preferred_username) {
      const usernameUser = await db
        .selectFrom('user')
        .selectAll()
        .where('username', '=', profile.preferred_username)
        .executeTakeFirst();
      if (usernameUser) {
        if (usernameUser.oauthId) {
          throw new Error(
            'Username already taken, and is linked to another account',
          );
        }
        user = await db
          .updateTable('user')
          .set('oauthId', profile.sub)
          .where('id', '=', usernameUser.id)
          .returningAll()
          .executeTakeFirst();
      }
    }

    if (!user) {
      if (!autoRegister) {
        throw new Error('User not found');
      }

      if (!profile.preferred_username) {
        throw new Error('preferred_username is required');
      }

      const displayName =
        profile.name ??
        `${profile.given_name || ''} ${profile.family_name || ''}`;
      user = await db
        .insertInto('user')
        .values({
          id: generateId(15),
          username: profile.preferred_username,
          displayName,
          oauthId: profile.sub,
          unit: 'metric',
          role: 'user',
        })
        .returningAll()
        .executeTakeFirst();
    }
  }),
});
