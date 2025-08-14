import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

import { appConfig } from '$lib/server/utils/config';

export const GET: RequestHandler = async ({ locals }) => {
  const user = locals.user;
  if (!user || user.role === 'user') {
    return new Response('Unauthorized', { status: 401 });
  }

  const config = await appConfig.get();
  const aeroDataBoxKey = config?.integrations?.aeroDataBoxKey ?? null;

  return json({ aeroDataBoxKey });
};
