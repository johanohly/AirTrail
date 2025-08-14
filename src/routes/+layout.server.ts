import { redirect } from '@sveltejs/kit';

import type { LayoutServerLoad } from './$types';

import { resolve } from '$app/paths';
import { db } from '$lib/db';
import { trpcServer } from '$lib/server/server';
import { appConfig } from '$lib/server/utils/config';

export const load = async (event: Parameters<LayoutServerLoad>[0]) => {
  if (
    (!event.locals.user || !event.locals.session) &&
    event.route.id !== '/(auth)/login' &&
    event.route.id !== '/(auth)/setup'
  ) {
    return redirect(302, resolve('/login'));
  }

  let user = null;
  if (event.locals.user) {
    const { password: _, ...rest } = event.locals.user;
    user = rest;
  }

  const config = await appConfig.getClientConfig();

  return {
    trpc: await trpcServer.hydrateToClient(event),
    user,
    users: (await db.selectFrom('user').selectAll().execute()).map(
      ({ password: _, ...rest }) => rest,
    ),
    appConfig: {
      config,
      configured: appConfig.configured,
      envConfigured: appConfig.envConfigured,
    },
  };
};
