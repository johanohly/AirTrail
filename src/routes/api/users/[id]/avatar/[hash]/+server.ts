import type { RequestHandler } from './$types';

import { getAvatar } from '$lib/server/utils/avatar';

/*
 * Public so pictures load on share pages. The URL needs both the random user
 * id and the content hash, and a stale hash returns 404, so the response can
 * be cached forever.
 */
export const GET: RequestHandler = async ({ params }) => {
  const data = await getAvatar(params.id, params.hash);
  if (!data) return new Response('Not found', { status: 404 });

  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
    },
  });
};
