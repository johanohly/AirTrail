import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { version } from '$app/environment';
import { API_SCOPE_DESCRIPTIONS, API_SCOPES } from '$lib/api/v1/scopes';

export const GET: RequestHandler = async () =>
  json(
    {
      api: {
        version: 'v1',
        minimumSupportedVersion: 'v1',
        documentation: '/api/v1/openapi.yaml',
      },
      instance: { name: 'AirTrail', version },
      authentication: {
        methods: ['api_key', 'oauth2_authorization_code_pkce'],
        bearerHeader: 'Authorization: Bearer <credential>',
      },
      mcp: {
        enabled: true,
        transport: 'streamable-http',
        endpoint: '/api/mcp',
        oauth: true,
      },
      scopes: API_SCOPES.map((scope) => ({
        name: scope,
        description: API_SCOPE_DESCRIPTIONS[scope],
      })),
    },
    { headers: { 'Cache-Control': 'public, max-age=60' } },
  );
