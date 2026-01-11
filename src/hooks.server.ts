import { type Handle, type ServerInit } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import type { Cookie } from 'lucia';

import { lucia } from '$lib/server/auth';
import { validateAirlineIcons } from '$lib/server/utils/airline';
import { appConfig } from '$lib/server/utils/config';
import {
  ensureInitialDataSync,
  syncAirlineIcons,
} from '$lib/server/utils/sync';
import { uploadManager } from '$lib/server/utils/uploads';
import { ensureAirports } from '$lib/utils/data/airports/source';

async function loadConfig() {
  await appConfig.get();
  await appConfig.loadFromEnv();
}

export const init: ServerInit = async () => {
  try {
    await loadConfig();
  } catch (err) {
    console.error('Error loading app config from .env:', err);
    process.exit(-1);
  }

  await ensureAirports();
  await uploadManager.init();
  await ensureInitialDataSync();
  await validateAirlineIcons();
  await syncAirlineIcons({ onlyIfNoIcons: true });
};

const authHandle: Handle = async ({ event, resolve }) => {
  const sessionId = event.cookies.get(lucia.sessionCookieName);
  if (!sessionId) {
    event.locals.user = null;
    event.locals.session = null;
    return resolve(event);
  }

  const { session, user } = await lucia.validateSession(sessionId);
  let sessionCookie: Cookie | undefined;
  if (session?.fresh) {
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
};

export const handle: Handle = sequence(authHandle);
