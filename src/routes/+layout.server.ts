import { redirect } from '@sveltejs/kit';

import type { LayoutServerLoad } from './$types';

import { resolve } from '$app/paths';
import { db } from '$lib/db';
import { trpcServer } from '$lib/server/server';
import { appConfig } from '$lib/server/utils/config';
import { publicUserSelect, toPageUser } from '$lib/server/utils/user';

export const load = async (event: Parameters<LayoutServerLoad>[0]) => {
  if (
    (!event.locals.user || !event.locals.session) &&
    event.route.id !== '/(auth)/login' &&
    event.route.id !== '/(auth)/setup' &&
    event.route.id !== '/share/[slug]'
  ) {
    return redirect(302, resolve('/login'));
  }

  const config = await appConfig.getClientConfig();

  return {
    trpc: await trpcServer.hydrateToClient(event),
    user: event.locals.user ? toPageUser(event.locals.user) : null,
    users: await db.selectFrom('user').select(publicUserSelect).execute(),
    appConfig: {
      config,
      configured: appConfig.configured,
      envConfigured: appConfig.envConfigured,
    },
  };
};
