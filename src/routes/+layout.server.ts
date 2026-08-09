import { redirect } from '@sveltejs/kit';

import type { LayoutServerLoad } from './$types';

import { resolve } from '$app/paths';
import { db } from '$lib/db';
import { trpcServer } from '$lib/server/server';
import { appConfig } from '$lib/server/utils/config';
import { hasPermission } from '$lib/server/authorization/authorize';
import { toClientAuthorization } from '$lib/server/authorization/context';
import { publicUserQuery, toPageUser } from '$lib/server/utils/user';

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
  const authorization = event.locals.authorization;
  const canReadDirectory = authorization
    ? hasPermission(authorization, 'users.directory.read')
    : false;

  return {
    trpc: await trpcServer.hydrateToClient(event),
    user:
      event.locals.user && authorization
        ? toPageUser(event.locals.user, authorization)
        : null,
    authorization: authorization ? toClientAuthorization(authorization) : null,
    users: canReadDirectory ? await publicUserQuery(db).execute() : [],
    appConfig: {
      config,
      configured: appConfig.configured,
      envConfigured: appConfig.envConfigured,
    },
  };
};
