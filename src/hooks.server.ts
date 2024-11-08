import { lucia } from '$lib/server/auth';
import type { Cookie } from 'lucia';

export async function handle({ event, resolve }) {
  const sessionId = event.cookies.get(lucia.sessionCookieName);
  if (!sessionId) {
    event.locals.user = null;
    event.locals.session = null;
    return resolve(event);
  }

  const { session, user } = await lucia.validateSession(sessionId);
  let sessionCookie: Cookie | undefined;
  if (session && session.fresh) {
    sessionCookie = lucia.createSessionCookie(session.id);
  }
  if (!session) {
    sessionCookie = lucia.createBlankSessionCookie();
  }
  if (sessionCookie) {
    event.cookies.set(sessionCookie.name, sessionCookie.value, {
      path: '.',
      ...sessionCookie.attributes,
    });
  }

  event.locals.user = user;
  event.locals.session = session;
  return resolve(event);
}
