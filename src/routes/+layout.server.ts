import { trpcServer } from '$lib/server/server';
import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: LayoutServerLoad = async (event) => {
  if (
    (!event.locals.user || !event.locals.session) &&
    event.url.pathname !== '/login' &&
    event.url.pathname !== '/signup' &&
    event.url.pathname !== '/setup'
  ) {
    return redirect(302, '/login');
  }

  return {
    trpc: await trpcServer.hydrateToClient(event),
    user: event.locals.user,
  };
};
