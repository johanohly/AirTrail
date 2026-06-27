import { error, json } from '@sveltejs/kit';
import { generateId } from 'lucia';
import type { UserInfoResponse } from 'openid-client';
import { z } from 'zod';

import type { RequestHandler } from './$types';

import { db } from '$lib/db';
import type { User } from '$lib/db/types';
import { lucia } from '$lib/server/auth';
import { createSession, getUserWithOAuthId } from '$lib/server/utils/auth';
import { appConfig } from '$lib/server/utils/config';
import {
  getOAuthProfile,
  OAUTH_CODE_VERIFIER_COOKIE,
  OAUTH_STATE_COOKIE,
} from '$lib/server/utils/oauth';
import {
  createOAuthLinkToken,
  linkOAuthAccount,
} from '$lib/server/utils/oauth-link-token';
import { usernameSchema } from '$lib/zod/user';

const CallbackSchema = z.object({
  url: z.string().url(),
});

export const POST: RequestHandler = async ({ cookies, request, locals }) => {
  const body = await request.json();
  const parsed = CallbackSchema.safeParse(body);
  if (!parsed.success) {
    return error(500, parsed.error.toString());
  }

  const { url } = parsed.data;
  const expectedState = cookies.get(OAUTH_STATE_COOKIE);
  if (!expectedState) {
    return error(400, 'OAuth state is missing');
  }

  const codeVerifier = cookies.get(OAUTH_CODE_VERIFIER_COOKIE);
  if (!codeVerifier) {
    return error(400, 'OAuth code verifier is missing');
  }

  cookies.delete(OAUTH_STATE_COOKIE, { path: '/' });
  cookies.delete(OAUTH_CODE_VERIFIER_COOKIE, { path: '/' });

  const config = await appConfig.get();
  if (!config) {
    return error(500, 'Failed to load config');
  }

  let profile: UserInfoResponse;
  try {
    profile = await getOAuthProfile(url, expectedState, codeVerifier);
  } catch {
    return error(400, 'Invalid OAuth callback, please try again');
  }

  const { autoRegister } = config.oauth;

  let user: User | undefined = locals.user ?? undefined;

  // Case 1: User is already logged in (user triggered account linking)
  if (user) {
    if (user.oauthId) {
      return error(500, 'User is already linked to an account');
    }

    const linkResult = await linkOAuthAccount(user.id, profile.sub);
    if (!linkResult.success && linkResult.reason === 'duplicate_oauth') {
      return error(500, 'Account is already linked to another user');
    }
    if (!linkResult.success && linkResult.reason === 'invalid_token') {
      return error(500, 'Failed to link OAuth account');
    }
    if (!linkResult.success) {
      return error(500, 'User is already linked to an account');
    }
  }

  // Case 2: User is not logged in (user is logging in via OAuth)
  if (!user) {
    user = await db
      .selectFrom('user')
      .selectAll()
      .where('oauthId', '=', profile.sub)
      .executeTakeFirst();
  }

  // Case 3: User has not logged in via OAuth before, but has an account.
  // preferred_username is only a hint; local password auth is required before linking.
  if (!user && profile.preferred_username) {
    const usernameUser = await getUserWithOAuthId(profile.preferred_username);
    if (usernameUser) {
      if (usernameUser.oauthId && usernameUser.oauthId !== profile.sub) {
        return error(
          500,
          'Username already taken, and is linked to another account',
        );
      }

      if (!usernameUser.oauthId) {
        const linkToken = await createOAuthLinkToken(
          usernameUser.id,
          profile.sub,
        );
        return json(
          {
            code: 'oauth_link_required',
            username: usernameUser.username,
            linkToken,
          },
          { status: 409 },
        );
      } else {
        user = usernameUser;
      }
    }
  }

  // Case 4: User has not logged in via OAuth before, and does not have an account
  if (!user) {
    if (!autoRegister) {
      return error(500, 'You do not have an AirTrail account');
    }

    if (!profile.preferred_username) {
      return error(500, 'Username not provided');
    }

    const username = usernameSchema.safeParse(profile.preferred_username);
    if (!username.success) {
      return error(
        400,
        username.error.issues[0]?.message ??
          'Username provided by OAuth provider is invalid',
      );
    }

    const displayName =
      profile.name ??
      `${profile.given_name || ''} ${profile.family_name || ''}`;
    user = await db
      .insertInto('user')
      .values({
        id: generateId(15),
        username: username.data,
        displayName,
        oauthId: profile.sub,
        role: 'user',
      })
      .returningAll()
      .executeTakeFirst();
  }

  if (!user) {
    return error(500, 'Failed to create user');
  }

  await createSession(lucia, user.id, cookies);
  return json({ success: true });
};
