import { error, redirect } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

import { resolve } from '$app/paths';
import { db } from '$lib/db';
import { lucia } from '$lib/server/auth';
import { ACCOUNTS, isDemoAccount } from '$lib/server/demo/accounts';
import { isPublicDemo } from '$lib/server/demo/mode';
import { createSession } from '$lib/server/utils/auth';

/*
 * The demo's front door: signs the visitor in as a demo account, Maya unless
 * `?as=` names another, and opens the map. Also used by the account switcher.
 */
export const GET: RequestHandler = async ({ url, cookies, locals }) => {
  if (!isPublicDemo()) error(404, 'Not found');

  const key = url.searchParams.get('as') ?? 'maya';
  if (!isDemoAccount(key)) error(404, 'Unknown demo account');

  const user = await db
    .selectFrom('user')
    .select('id')
    .where('username', '=', ACCOUNTS[key].username)
    .executeTakeFirst();
  if (!user) {
    error(404, `${ACCOUNTS[key].displayName} was deleted in this demo`);
  }

  if (locals.session) await lucia.invalidateSession(locals.session.id);
  await createSession(lucia, user.id, cookies);
  redirect(303, resolve('/'));
};
