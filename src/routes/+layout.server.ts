import { trpcServer } from '$lib/server/server';
import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load = async (event: Parameters<LayoutServerLoad>[0]) => {
  if (
    (!event.locals.user || !event.locals.session) &&
    event.url.pathname !== '/login' &&
    event.url.pathname !== '/setup'
  ) {
    return redirect(302, '/login');
  }

  let user = null;
  if (event.locals.user) {
    const { password: _, ...rest } = event.locals.user;
    user = rest;
  }

  return {
    trpc: await trpcServer.hydrateToClient(event),
    user,
  };
};
