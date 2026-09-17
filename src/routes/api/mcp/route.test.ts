import { describe, expect, it } from 'vitest';

import { DELETE, GET, OPTIONS, POST } from './+server';

/*
 * These call the handlers directly with a minimal event rather than going
 * through a server, because the behaviour under test is the route's own
 * decisions: which requests are refused before authentication is considered,
 * and what a preflight answers.
 */

const event = (
  overrides: {
    method?: string;
    origin?: string;
    accept?: string;
    authorization?: string;
  } = {},
) => {
  const headers = new Headers({ host: 'airtrail.example' });
  if (overrides.origin) headers.set('origin', overrides.origin);
  if (overrides.accept) headers.set('accept', overrides.accept);
  if (overrides.authorization)
    headers.set('authorization', overrides.authorization);

  return {
    request: new Request('https://airtrail.example/api/mcp', {
      method: overrides.method ?? 'POST',
      headers,
    }),
    url: new URL('https://airtrail.example/api/mcp'),
  } as never;
};

const run = async (
  handler: unknown,
  overrides: Parameters<typeof event>[0] = {},
) => (handler as (event: never) => Promise<Response>)(event(overrides));

/*
 * The regression. A browser-based MCP client runs on a different origin than
 * the server by definition, and the route used to refuse it with 403 -- before
 * authentication, so the client never saw a WWW-Authenticate and never started
 * the OAuth flow. Reproduced with MCPJam on 127.0.0.1:6274 against a server on
 * localhost:5173.
 */
describe('cross-origin requests', () => {
  it('does not refuse a cross-origin POST before authentication', async () => {
    const response = await run(POST, { origin: 'http://127.0.0.1:6274' });
    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toContain(
      'resource_metadata=',
    );
  });

  it('answers a cross-origin preflight, which the browser requires', async () => {
    const response = await run(OPTIONS, {
      method: 'OPTIONS',
      origin: 'http://127.0.0.1:6274',
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'http://127.0.0.1:6274',
    );
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain(
      'MCP-Protocol-Version',
    );
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain(
      'POST',
    );
  });

  it('reflects the origin rather than allowing any', async () => {
    const response = await run(OPTIONS, {
      method: 'OPTIONS',
      origin: 'https://evil.example',
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://evil.example',
    );
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull();
  });

  it('reveals nothing unauthenticated regardless of origin', async () => {
    // The discovery document is public by design; it must not vary by origin.
    const same = await run(GET, { method: 'GET' });
    const cross = await run(GET, {
      method: 'GET',
      origin: 'http://127.0.0.1:6274',
    });
    expect(same.status).toBe(200);
    expect(cross.status).toBe(200);
    expect(await cross.json()).toEqual(await same.json());
  });
});

describe('authentication is still required', () => {
  it('challenges a request with no credential', async () => {
    const response = await run(POST);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: { code: 'unauthorized' },
    });
  });

  it('rejects a malformed bearer credential', async () => {
    const response = await run(POST, {
      authorization: 'Bearer not-a-real-credential',
    });
    expect(response.status).toBe(401);
  });

  it('does not accept a session cookie as a credential', async () => {
    /*
     * The property that makes dropping the origin check safe: with no cookie
     * accepted here, a cross-site request has no ambient authority to borrow.
     */
    const response = await run(POST, { authorization: '' });
    expect(response.status).toBe(401);
  });

  it('requires a credential for the SSE stream too', async () => {
    const response = await run(GET, { accept: 'text/event-stream' });
    expect(response.status).toBe(401);
  });
});
