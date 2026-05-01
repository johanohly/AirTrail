import type { RequestHandler } from './$types';

import { appConfig } from '$lib/server/utils/config';
import { fetchIntegration } from '$lib/server/utils/integration-fetch';

const OPENAIP_TILE_BASE_URL = 'https://api.tiles.openaip.net/api/data/openaip';
const PRIVATE_CACHE_CONTROL =
  'private, max-age=300, stale-while-revalidate=3600';
const AUTH_VARY = 'cookie, authorization';

export const GET: RequestHandler = async ({ locals, params, fetch }) => {
  if (!locals.user) {
    return new Response('Unauthorized', {
      status: 401,
      headers: {
        'cache-control': 'private, no-store',
        vary: AUTH_VARY,
      },
    });
  }

  const apiKey =
    (await appConfig.get())?.integrations?.openAipKey?.trim() ?? '';
  if (!apiKey) {
    return new Response('OpenAIP API key not configured', {
      status: 503,
      headers: {
        'cache-control': 'private, no-store',
        vary: AUTH_VARY,
      },
    });
  }

  const upstream = await fetchIntegration(
    `${OPENAIP_TILE_BASE_URL}/${params.z}/${params.x}/${params.y}.pbf`,
    {
      headers: {
        'x-openaip-api-key': apiKey,
        accept: 'application/vnd.mapbox-vector-tile,application/x-protobuf',
      },
    },
    fetch,
  );

  if (upstream.status === 204) {
    return new Response(null, {
      status: 204,
      headers: {
        'cache-control': PRIVATE_CACHE_CONTROL,
        vary: AUTH_VARY,
      },
    });
  }

  if (!upstream.ok || !upstream.body) {
    return new Response(null, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: {
        'cache-control': PRIVATE_CACHE_CONTROL,
        vary: AUTH_VARY,
      },
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type':
        upstream.headers.get('content-type') ?? 'application/x-protobuf',
      'cache-control': PRIVATE_CACHE_CONTROL,
      vary: AUTH_VARY,
      ...(upstream.headers.get('etag')
        ? { etag: upstream.headers.get('etag')! }
        : {}),
      ...(upstream.headers.get('last-modified')
        ? { 'last-modified': upstream.headers.get('last-modified')! }
        : {}),
    },
  });
};
