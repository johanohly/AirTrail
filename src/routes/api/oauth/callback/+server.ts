import type { RequestHandler } from './$types';
import { z } from 'zod';
import { error, json } from '@sveltejs/kit';
import { fetchAppConfig } from '$lib/server/utils/config';
import { getOAuthProfile } from '$lib/server/utils/oauth';
import { db } from '$lib/db';
import { generateId } from 'lucia';
import { createSession } from '$lib/server/utils/auth';
import { lucia } from '$lib/server/auth';

const CallbackSchema = z.object({
  url: z.string().url(),
});

export const POST: RequestHandler = async ({ cookies, request }) => {
  const body = await request.json();
  const parsed = CallbackSchema.safeParse(body);
  if (!parsed.success) {
    return error(500, parsed.error.toString());
  }

  const { url } = parsed.data;
  const config = await fetchAppConfig();
  if (!config) {
    return error(500, 'OAuth is not enabled');
  }

  let profile;
  try {
    profile = await getOAuthProfile(url);
  } catch (e) {
    console.error(e);
    return error(500, 'Invalid state, please try again');
  }
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
      return error(500, 'User not found');
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
