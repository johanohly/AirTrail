import type { RequestHandler } from './$types';
import { z } from 'zod';
import { error, json } from '@sveltejs/kit';
import { getOAuthProfile } from '$lib/server/utils/oauth';
import { db, type User } from '$lib/db';
import { generateId } from 'lucia';
import { createSession } from '$lib/server/utils/auth';
import { lucia } from '$lib/server/auth';
import { appConfig } from '$lib/server/utils/config';

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
  const config = await appConfig.get();
  if (!config) {
    return error(500, 'Failed to load config');
  }

  let profile;
  try {
    profile = await getOAuthProfile(url);
  } catch (e) {
    console.error(e);
    return error(500, 'Invalid state, please try again');
  }

  const { autoRegister } = config.oauth;

  let user: User | undefined = locals.user ?? undefined;

  // Case 1: User is already logged in (user triggered account linking)
  if (user) {
    if (user.oauthId) {
      return error(500, 'User is already linked to an account');
    }

    const existingUser = await db
      .selectFrom('user')
      .selectAll()
      .where('oauthId', '=', profile.sub)
      .executeTakeFirst();
    if (existingUser) {
      return error(500, 'Account is already linked to another user');
    }

    user = await db
      .updateTable('user')
      .set('oauthId', profile.sub)
      .where('id', '=', user.id)
      .returningAll()
      .executeTakeFirst();
  }

  // Case 2: User is not logged in (user is logging in via OAuth)
  if (!user) {
    user = await db
      .selectFrom('user')
      .selectAll()
      .where('oauthId', '=', profile.sub)
      .executeTakeFirst();
  }

  // Case 3: User has not logged in via OAuth before, but has an account (we assume the username is owned by the user)
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

  // Case 4: User has not logged in via OAuth before, and does not have an account
  if (!user) {
    if (!autoRegister) {
      return error(500, 'You do not have an AirTrail account');
    }

    if (!profile.preferred_username) {
      return error(500, 'Username not provided');
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

  if (!user) {
    return error(500, 'Failed to create user');
  }

  await createSession(lucia, user.id, cookies);
  return json({ success: true });
};
