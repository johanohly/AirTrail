import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { createMcpDiscovery } from '$lib/api/v1/discovery';
import {
  PROTECTED_RESOURCES,
  protectedResourceUrl,
} from '$lib/api/v1/resources';
import { authenticateApiPrincipal } from '$lib/server/api/v1/principal';
import { apiV1Unauthorized } from '$lib/server/api/v1/errors';
import { handleMcpRequest } from '$lib/server/mcp/server';

/*
 * Authority comes from the `Authorization` header alone -- this route never
 * reads cookies or `locals` -- so it has no same-origin check, and CORS is
 * open (see `$lib/server/security/cors`).
 */
const authenticateMcpRequest = async (request: Request, origin: string) => {
  const principal = await authenticateApiPrincipal(
    request,
    protectedResourceUrl(origin, 'mcp'),
  );
  if (principal) return principal;

  return apiV1Unauthorized(
    'mcp',
    PROTECTED_RESOURCES.mcp.defaultScopes.join(' '),
    origin,
  );
};

const methodNotAllowed = () =>
  new Response(null, {
    status: 405,
    headers: {
      Allow: 'POST, OPTIONS',
      'Cache-Control': 'private, no-store',
    },
  });

export const POST: RequestHandler = async ({ request, url }) => {
  const principal = await authenticateMcpRequest(request, url.origin);
  if (principal instanceof Response) return principal;

  try {
    return await handleMcpRequest(request, principal);
  } catch (error) {
    console.error('[mcp] request failed', error);
    return json(
      {
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      },
      { status: 500 },
    );
  }
};

export const GET: RequestHandler = async ({ request, url }) => {
  if (!request.headers.get('Accept')?.includes('text/event-stream')) {
    return json(createMcpDiscovery(url.origin), {
      headers: {
        'Cache-Control': 'public, max-age=60',
        Vary: 'Accept',
      },
    });
  }

  const principal = await authenticateMcpRequest(request, url.origin);
  if (principal instanceof Response) return principal;
  return methodNotAllowed();
};

export const DELETE: RequestHandler = async ({ request, url }) => {
  const principal = await authenticateMcpRequest(request, url.origin);
  if (principal instanceof Response) return principal;
  return methodNotAllowed();
};
