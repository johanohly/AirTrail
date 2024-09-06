import { lucia } from '$lib/server/auth';
import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
  if (!event.locals.session) {
    return error(401, 'Unauthorized');
  }

  await lucia.invalidateSession(event.locals.session.id);

  const sessionCookie = lucia.createBlankSessionCookie();
  event.cookies.set(sessionCookie.name, sessionCookie.value, {
    path: '.',
    ...sessionCookie.attributes,
  });

  redirect(302, '/login');
};
