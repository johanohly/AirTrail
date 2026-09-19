import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { authenticateApiPrincipal } from '$lib/server/api/v1/principal';
import { apiV1Unauthorized } from '$lib/server/api/v1/errors';
import { handleMcpRequest } from '$lib/server/mcp/server';
import {
  PROTECTED_RESOURCES,
  protectedResourceMetadataUrl,
  protectedResourceUrl,
} from '$lib/api/v1/resources';

/*
 * There is deliberately no same-origin check here, unlike every other mutating
 * endpoint. This route derives its authority solely from the `Authorization`
 * header: it never reads cookies or `locals`, and `authenticateApiPrincipal`
 * takes the credential from the header alone. With no ambient authority, a
 * cross-site request can present nothing a same-site one could not, so refusing
 * it adds no security -- and it broke every browser-based MCP client, whose
 * page necessarily runs on a different origin than the server.
 *
 * An earlier version compared the request's `Origin` against `url.origin`. That
 * is a string against a server-derived value, so it also refused legitimate
 * requests whenever a proxy made the public origin differ from the decoded one.
 * `src/hooks.server.ts` still enforces the origin for cookie-authenticated form
 * posts, which is where the check actually protects something.
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
  } catch {
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};

export const GET: RequestHandler = async ({ request, url }) => {
  if (!request.headers.get('Accept')?.includes('text/event-stream')) {
    return json(
      {
        name: 'AirTrail',
        protocol: 'Model Context Protocol',
        transport: {
          type: 'streamable-http',
          endpoint: protectedResourceUrl(url.origin, 'mcp'),
          stateless: true,
        },
        authentication: {
          methods: ['api_key', 'oauth2_authorization_code_pkce'],
          bearerHeader: 'Authorization: Bearer <credential>',
          protectedResourceMetadata: protectedResourceMetadataUrl(
            url.origin,
            'mcp',
          ),
        },
        apiDiscovery: `${url.origin}/api`,
        documentation:
          'https://airtrail.johan.ohly.dk/docs/api/model-context-protocol',
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=60',
          Vary: 'Accept',
        },
      },
    );
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

/*
 * A preflight carries no credentials and no authority, and the browser refuses
 * to send the real request unless this succeeds -- so this cannot be gated on
 * anything, including authentication. It reflects the requesting origin rather
 * than allowing `*` so the answer stays correct if credentialed requests are
 * ever added. (Note that SvelteKit's own CORS handling runs before this handler
 * and already sets `Access-Control-Allow-Origin`; these headers make the
 * intended contract explicit and are what the route test asserts on.)
 */
export const OPTIONS: RequestHandler = async ({ request }) => {
  const requestOrigin = request.headers.get('Origin');
  return new Response(null, {
    status: 204,
    headers: {
      Allow: 'POST, OPTIONS',
      ...(requestOrigin
        ? { 'Access-Control-Allow-Origin': requestOrigin }
        : {}),
      'Access-Control-Allow-Headers':
        'Authorization, Content-Type, MCP-Protocol-Version',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      Vary: 'Origin',
    },
  });
};
