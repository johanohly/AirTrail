import { text, type Handle, type ServerInit } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import type { Cookie } from 'lucia';

import '$lib/zod/setup';
import {
  corsPreflight,
  isCorsPath,
  withCorsHeaders,
} from '$lib/server/security/cors';
import { isCrossSiteFormPost } from '$lib/server/security/csrf';
import { lucia } from '$lib/server/auth';
import { loadAuthorizationContext } from '$lib/server/authorization/context';
import { demoMode, isPublicDemo } from '$lib/server/demo/mode';
import { seedDemo } from '$lib/server/demo/seed';
import { validateAirlineIcons } from '$lib/server/utils/airline';
import { isSetup } from '$lib/server/utils/auth';
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

  if (demoMode() !== 'off' && !(await isSetup())) {
    console.log('Seeding the demo...');
    const { flights } = await seedDemo();
    console.log(`Demo seeded with ${flights} flights.`);
  }
};

// Demo instances are throwaway copies that search engines shouldn't index.
const demoHandle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);
  if (isPublicDemo()) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
};

const corsHandle: Handle = async ({ event, resolve }) => {
  if (!isCorsPath(event.url.pathname)) return resolve(event);
  if (event.request.method === 'OPTIONS') return corsPreflight();
  return withCorsHeaders(await resolve(event));
};

const csrfHandle: Handle = async ({ event, resolve }) => {
  const { request, url } = event;
  if (
    isCrossSiteFormPost({
      method: request.method,
      pathname: url.pathname,
      contentType: request.headers.get('content-type'),
      origin: request.headers.get('origin'),
      expectedOrigin: url.origin,
    })
  ) {
    return text(`Cross-site ${request.method} form submissions are forbidden`, {
      status: 403,
    });
  }
  return resolve(event);
};

const authHandle: Handle = async ({ event, resolve }) => {
  const sessionId = event.cookies.get(lucia.sessionCookieName);
  if (!sessionId) {
    event.locals.user = null;
    event.locals.session = null;
    event.locals.authorization = null;
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
  event.locals.authorization = user
    ? await loadAuthorizationContext(user.id)
    : null;
  return resolve(event);
};

/*
 * https://github.com/sveltejs/kit/issues/11084
 * Fixed in sveltekit v3, by gating Link header generation behind config.kit.output.linkHeaderPreload
 */
const dropExcessiveLinkHeaderHandle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);

  if (Number(response.headers.get('Link')?.length) > 3700) {
    response.headers.delete('Link');
  }
  return response;
};

export const handle: Handle = sequence(
  corsHandle,
  csrfHandle,
  authHandle,
  demoHandle,
  dropExcessiveLinkHeaderHandle,
);
