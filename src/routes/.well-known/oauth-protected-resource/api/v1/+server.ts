import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { API_SCOPES } from '$lib/api/v1/scopes';

export const GET: RequestHandler = ({ url }) =>
  json(
    {
      resource: `${url.origin}/api/v1`,
      authorization_servers: [url.origin],
      bearer_methods_supported: ['header'],
      scopes_supported: API_SCOPES,
    },
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  );
