import { lucia } from '$lib/server/auth';
import type { Cookie } from 'lucia';
import { appConfig } from '$lib/server/utils/config';

async function loadConfig() {
  await appConfig.get();
  await appConfig.loadFromEnv();
}

const setup = loadConfig().catch((err) => {
  console.error('Error loading app config from .env:', err);
  process.exit(-1);
});

export async function handle({ event, resolve }) {
  await setup;

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
