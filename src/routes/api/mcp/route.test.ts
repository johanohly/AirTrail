import { describe, expect, it, vi } from 'vitest';

import { GET, POST } from './+server';

/*
 * No credential lookup finds anything: every query chain resolves to no row,
 * so these tests need no database.
 */
vi.mock('$lib/db', () => {
  const query: object = new Proxy(() => query, {
    get: (_, key) =>
      key === 'executeTakeFirst' ? async () => undefined : query,
    apply: () => query,
  });
  return { db: query };
});

/*
 * These call the handlers directly with a minimal event, because the behaviour
 * under test is the route's own decisions: which requests are refused before
 * authentication is considered.
 */

const event = (
  overrides: {
    method?: string;
    origin?: string;
    accept?: string;
    authorization?: string;
    cookie?: string;
  } = {},
) => {
  const headers = new Headers({ host: 'airtrail.example' });
  if (overrides.cookie) headers.set('cookie', overrides.cookie);
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
 * A browser-based MCP client runs on another origin by definition, and must
 * reach authentication to see the WWW-Authenticate that starts the OAuth flow.
 */
describe('cross-origin requests', () => {
  it('does not refuse a cross-origin POST before authentication', async () => {
    const response = await run(POST, { origin: 'http://127.0.0.1:6274' });
    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toContain(
      'resource_metadata=',
    );
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
    const response = await run(POST, { cookie: 'auth_session=valid-session' });
    expect(response.status).toBe(401);
  });

  it('requires a credential for the SSE stream too', async () => {
    const response = await run(GET, { accept: 'text/event-stream' });
    expect(response.status).toBe(401);
  });
});
