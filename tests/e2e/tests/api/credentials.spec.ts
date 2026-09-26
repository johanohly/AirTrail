import { createHash, randomUUID } from 'node:crypto';

import { airportsFactory } from '@test/factories/airports';
import { usersFactory } from '@test/factories/users';
import { db, expect, test } from '@test/index';

import type { ApiScope } from '$lib/api/v1/scopes';
import { hashSha256 } from '$lib/server/utils/hash';

const ORIGIN = 'http://localhost:3000';
const API_V1 = `${ORIGIN}/api/v1`;
const MCP = `${ORIGIN}/api/mcp`;

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

const createApiKey = async (userId: string, scopes: ApiScope[]) => {
  const key = `key_${randomUUID()}`;
  await db
    .insertInto('apiKey')
    .values({ name: 'e2e', userId, key: hashSha256(key), scopes })
    .execute();
  return key;
};

/*
 * An authorization code as /oauth/consent would issue it, written directly so
 * the token endpoint can be exercised without driving the browser flow.
 */
const createAuthorizationCode = async (
  userId: string,
  scopes: ApiScope[],
  resource: string,
) => {
  const clientId = `client_${randomUUID()}`;
  const grantId = randomUUID();
  const code = randomUUID();
  const verifier = `${randomUUID()}${randomUUID()}`;
  const redirectUri = 'http://127.0.0.1:9999/callback';
  await db
    .insertInto('oauthClient')
    .values({ id: clientId, name: 'e2e', tokenEndpointAuthMethod: 'none' })
    .execute();
  await db
    .insertInto('oauthGrant')
    .values({ id: grantId, clientId, userId, resource, scopes })
    .execute();
  await db
    .insertInto('oauthAuthorizationCode')
    .values({
      codeHash: hashSha256(code),
      clientId,
      userId,
      grantId,
      redirectUri,
      scopes,
      resource,
      codeChallenge: createHash('sha256').update(verifier).digest('base64url'),
      expiresAt: new Date(Date.now() + 60_000),
    })
    .execute();
  return {
    clientId,
    grantId,
    exchange: {
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      code_verifier: verifier,
      resource,
    },
  };
};

test.describe('scoped API keys', () => {
  test('are limited to their scopes on v1 and the legacy API', async ({
    request,
  }) => {
    const { user } = await usersFactory.create();
    const key = await createApiKey(user.id, ['profile.read']);

    const me = await request.get('/api/v1/me', { headers: bearer(key) });
    expect(me.status()).toBe(200);

    const flights = await request.get('/api/v1/flights', {
      headers: bearer(key),
    });
    expect(flights.status()).toBe(403);
    expect(await flights.json()).toMatchObject({
      error: { code: 'insufficient_scope' },
    });

    const legacy = await request.get('/api/flight/list', {
      headers: bearer(key),
    });
    expect(legacy.status()).toBe(403);
  });

  test('need the passenger scope to create a flight with other passengers', async ({
    request,
  }) => {
    const { user } = await usersFactory.create();
    const { user: other } = await usersFactory.create();
    const { airport } = await airportsFactory.getOrCreate({
      icao: 'EKCH',
      name: 'Copenhagen Airport',
      lat: 55.618,
      lon: 12.656,
      country: 'DK',
      continent: 'EU',
      tz: 'Europe/Copenhagen',
      type: 'large_airport',
    });
    const key = await createApiKey(user.id, ['flight.create.own']);
    const flight = (passengers: string[]) => ({
      date: '2026-01-01',
      fromId: airport.id,
      toId: airport.id,
      passengers: passengers.map((userId) => ({ userId })),
    });

    const withOther = await request.post('/api/v1/flights', {
      headers: bearer(key),
      data: flight([user.id, other.id]),
    });
    expect(withOther.status()).toBe(403);

    const alone = await request.post('/api/v1/flights', {
      headers: bearer(key),
      data: flight([user.id]),
    });
    expect(alone.status()).toBe(201);
  });
});

test.describe('OAuth tokens', () => {
  test('work only on the resource they were issued for', async ({
    request,
  }) => {
    const { user } = await usersFactory.create();
    const { exchange } = await createAuthorizationCode(
      user.id,
      ['profile.read', 'flight.read.own'],
      MCP,
    );
    const token = await request.post('/oauth/token', { form: exchange });
    expect(token.status()).toBe(200);
    const { access_token } = await token.json();

    for (const path of ['/api/v1/me', '/api/flight/list']) {
      const response = await request.get(path, {
        headers: bearer(access_token),
      });
      expect(response.status(), path).toBe(401);
    }
  });

  test('replaying a code revokes what it issued', async ({ request }) => {
    const { user } = await usersFactory.create();
    const { exchange } = await createAuthorizationCode(
      user.id,
      ['profile.read'],
      API_V1,
    );
    const first = await request.post('/oauth/token', { form: exchange });
    const { access_token } = await first.json();
    expect(
      (
        await request.get('/api/v1/me', { headers: bearer(access_token) })
      ).status(),
    ).toBe(200);

    const replay = await request.post('/oauth/token', { form: exchange });
    expect(replay.status()).toBe(400);
    expect(
      (
        await request.get('/api/v1/me', { headers: bearer(access_token) })
      ).status(),
    ).toBe(401);
  });

  test('another client replaying a code revokes nothing', async ({
    request,
  }) => {
    const { user } = await usersFactory.create();
    const { exchange } = await createAuthorizationCode(
      user.id,
      ['profile.read'],
      API_V1,
    );
    const first = await request.post('/oauth/token', { form: exchange });
    const { access_token } = await first.json();

    const { clientId: otherClient } = await createAuthorizationCode(
      user.id,
      ['profile.read'],
      API_V1,
    );
    const foreign = await request.post('/oauth/token', {
      form: { ...exchange, client_id: otherClient },
    });
    expect(foreign.status()).toBe(400);
    expect(
      (
        await request.get('/api/v1/me', { headers: bearer(access_token) })
      ).status(),
    ).toBe(200);
  });

  test('reusing a refresh token revokes its family', async ({ request }) => {
    const { user } = await usersFactory.create();
    const { exchange, clientId } = await createAuthorizationCode(
      user.id,
      ['profile.read'],
      API_V1,
    );
    const issued = await (
      await request.post('/oauth/token', { form: exchange })
    ).json();
    const refresh = (refreshToken: string) =>
      request.post('/oauth/token', {
        form: {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
          resource: API_V1,
        },
      });

    const rotated = await refresh(issued.refresh_token);
    expect(rotated.status()).toBe(200);
    const { access_token } = await rotated.json();

    expect((await refresh(issued.refresh_token)).status()).toBe(400);
    expect(
      (
        await request.get('/api/v1/me', { headers: bearer(access_token) })
      ).status(),
    ).toBe(401);
  });

  test('a narrowed grant narrows refreshed tokens', async ({ request }) => {
    const { user } = await usersFactory.create();
    const { exchange, clientId, grantId } = await createAuthorizationCode(
      user.id,
      ['profile.read', 'flight.read.own'],
      API_V1,
    );
    const issued = await (
      await request.post('/oauth/token', { form: exchange })
    ).json();
    await db
      .updateTable('oauthGrant')
      .set({ scopes: ['profile.read'] })
      .where('id', '=', grantId)
      .execute();

    const rotated = await request.post('/oauth/token', {
      form: {
        grant_type: 'refresh_token',
        refresh_token: issued.refresh_token,
        client_id: clientId,
        resource: API_V1,
      },
    });
    expect((await rotated.json()).scope).toBe('profile.read');
  });
});

test.describe('browser clients', () => {
  test('can read the bearer challenge cross-origin', async ({ request }) => {
    const response = await request.post('/api/mcp', {
      headers: { Origin: 'http://127.0.0.1:6274' },
      data: {},
    });
    expect(response.status()).toBe(401);
    expect(response.headers()['access-control-allow-origin']).toBe('*');
    expect(response.headers()['access-control-expose-headers']).toContain(
      'WWW-Authenticate',
    );
  });
});
