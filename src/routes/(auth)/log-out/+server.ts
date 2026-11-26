import { error, redirect } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

import { lucia } from '$lib/server/auth';
import { deleteSession } from '$lib/server/utils/auth';

export const POST: RequestHandler = async (event) => {
  if (!event.locals.session) {
    return error(401, 'Unauthorized');
  }

  await lucia.invalidateSession(event.locals.session.id);
  await deleteSession(lucia, event.cookies);

  // Skip OAuth auto-login, or the provider's session logs the user straight back in.
  redirect(302, '/login?autoLogin=false');
};
