import type { RequestHandler } from './$types';

import { appConfig } from '$lib/server/utils/config';

const OPENAIP_TILE_BASE_URL = 'https://api.tiles.openaip.net/api/data/openaip';

export const GET: RequestHandler = async ({ locals, params, fetch }) => {
  if (!locals.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const apiKey =
    (await appConfig.get())?.integrations?.openAipKey?.trim() ?? '';
  if (!apiKey) {
    return new Response('OpenAIP API key not configured', { status: 503 });
  }

  const upstream = await fetch(
    `${OPENAIP_TILE_BASE_URL}/${params.z}/${params.x}/${params.y}.pbf`,
    {
      headers: {
        'x-openaip-api-key': apiKey,
        accept: 'application/vnd.mapbox-vector-tile,application/x-protobuf',
      },
    },
  );

  if (upstream.status === 204) {
    return new Response(null, { status: 204 });
  }

  if (!upstream.ok || !upstream.body) {
    return new Response(null, {
      status: upstream.status,
      statusText: upstream.statusText,
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type':
        upstream.headers.get('content-type') ?? 'application/x-protobuf',
      'cache-control':
        upstream.headers.get('cache-control') ??
        'public, max-age=300, stale-while-revalidate=3600',
      ...(upstream.headers.get('etag')
        ? { etag: upstream.headers.get('etag')! }
        : {}),
      ...(upstream.headers.get('last-modified')
        ? { 'last-modified': upstream.headers.get('last-modified')! }
        : {}),
    },
  });
};
