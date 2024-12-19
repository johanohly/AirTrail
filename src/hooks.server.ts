import { type Handle, json, type ServerInit, text } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import type { Cookie } from 'lucia';

import { env } from '$env/dynamic/private';
import { lucia } from '$lib/server/auth';
import { appConfig } from '$lib/server/utils/config';

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

/**
 * CSRF protection copied from SvelteKit but with the ability to provide multiple origins.
 * Logic duplicated from `https://github.com/sveltejs/kit/blob/143dbf9da9d65dedfc370160c229c317fe18361c/packages/kit/src/runtime/server/respond.js#L63`
 */
const csrfHandle: Handle = async ({ event, resolve }) => {
  const ORIGIN = env.ORIGIN;
  if (!ORIGIN) {
    return resolve(event);
  }

  const allowedOrigins = ORIGIN.split(',').map((origin) => origin.trim());

  const { request, url } = event;
  const forbidden =
    isFormContentType(request) &&
    (request.method === 'POST' ||
      request.method === 'PUT' ||
      request.method === 'PATCH' ||
      request.method === 'DELETE') &&
    request.headers.get('origin') !== url.origin &&
    !allowedOrigins.includes(request.headers.get('origin') ?? '');

  if (forbidden) {
    const message = `Cross-site ${request.method} form submissions are forbidden`;
    if (request.headers.get('accept') === 'application/json') {
      return json({ message }, { status: 403 });
    }
    return text(message, { status: 403 });
  }

  return resolve(event);
};

const isContentType = (request: Request, ...types: string[]) => {
  const type =
    request.headers.get('content-type')?.split(';', 1)[0]?.trim() ?? '';
  return types.includes(type.toLowerCase());
};

const isFormContentType = (request: Request) => {
  return isContentType(
    request,
    'application/x-www-form-urlencoded',
    'multipart/form-data',
    'text/plain',
  );
};

export const handle: Handle = sequence(csrfHandle, authHandle);
