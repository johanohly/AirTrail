import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { version } from '$app/environment';
import { createApiDiscovery } from '$lib/api/v1/discovery';

export const GET: RequestHandler = async () =>
  json(createApiDiscovery(version), {
    headers: { 'Cache-Control': 'public, max-age=60' },
  });
