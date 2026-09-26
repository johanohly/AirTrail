import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { db } from '$lib/db';
import { hashArgon2, hashSha256, verifyArgon2 } from '$lib/server/utils/hash';
import { parseScopes, type ApiScope } from '$lib/api/v1/scopes';
import type { DatabaseConnection } from '$lib/db/types';

const ACCESS_TOKEN_TTL_MS = 3_600_000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 3_600_000;
const AUTHORIZATION_CODE_TTL_MS = 60_000;
export const AUTHORIZATION_REQUEST_TTL_MS = 10 * 60_000;
/** A registered client that never obtained a grant is removed after this. */
const UNUSED_CLIENT_TTL_MS = 24 * 3_600_000;

export const randomOpaque = (bytes = 32) =>
  randomBytes(bytes).toString('base64url');
export const pkceChallenge = (verifier: string) =>
  createHash('sha256').update(verifier).digest('base64url');

export const createClient = async (input: {
  name: string;
  redirectUris: string[];
  tokenEndpointAuthMethod?: 'none' | 'client_secret_post';
}) => {
  const id = `client_${randomOpaque(18)}`;
  const method = input.tokenEndpointAuthMethod ?? 'none';
  const secret = method === 'none' ? null : randomOpaque(32);
  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto('oauthClient')
      .values({
        id,
        name: input.name,
        tokenEndpointAuthMethod: method,
        clientSecretHash: secret ? await hashArgon2(secret) : null,
      })
      .execute();
    await trx
      .insertInto('oauthClientRedirectUri')
      .values(
        input.redirectUris.map((redirectUri) => ({
          clientId: id,
          redirectUri,
        })),
      )
      .execute();
  });
  return { clientId: id, clientSecret: secret };
};

/*
 * Client authentication at the token and revocation endpoints. A public client
 * (`token_endpoint_auth_method: 'none'`) holds its `client_id` alone; a
 * confidential one must also present the secret it was issued.
 */
export const authenticateClient = async (
  clientId: string | null,
  clientSecret: string | null,
) => {
  if (!clientId) return null;
  const client = await db
    .selectFrom('oauthClient')
    .selectAll()
    .where('id', '=', clientId)
    .executeTakeFirst();
  if (!client) return null;
  if (
    client.tokenEndpointAuthMethod === 'client_secret_post' &&
    (!client.clientSecretHash ||
      !clientSecret ||
      !(await verifyArgon2(client.clientSecretHash, clientSecret)))
  )
    return null;
  return client;
};

export const validateRedirectUri = async (
  clientId: string,
  redirectUri: string,
) => {
  const row = await db
    .selectFrom('oauthClientRedirectUri')
    .select('redirectUri')
    .where('clientId', '=', clientId)
    .where('redirectUri', '=', redirectUri)
    .executeTakeFirst();
  return Boolean(row);
};

export const issueAuthorizationCode = async (input: {
  clientId: string;
  userId: string;
  redirectUri: string;
  scopes: ApiScope[];
  resource: string;
  codeChallenge: string;
}) => {
  const code = randomOpaque(32);
  const now = new Date();
  await db.transaction().execute(async (trx) => {
    // oauth_grant has a unique key on (client_id, user_id, resource), so this
    // is one statement rather than a read plus a branch with a TOCTOU window.
    const grant = await trx
      .insertInto('oauthGrant')
      .values({
        id: randomUUID(),
        clientId: input.clientId,
        userId: input.userId,
        resource: input.resource,
        scopes: input.scopes,
      })
      .onConflict((oc) =>
        oc
          .columns(['clientId', 'userId', 'resource'])
          .doUpdateSet({ scopes: input.scopes, updatedAt: now }),
      )
      .returning('id')
      .executeTakeFirstOrThrow();
    const actualGrantId = grant.id;
    await trx
      .insertInto('oauthAuthorizationCode')
      .values({
        codeHash: hashSha256(code),
        clientId: input.clientId,
        userId: input.userId,
        grantId: actualGrantId,
        redirectUri: input.redirectUri,
        scopes: input.scopes,
        resource: input.resource,
        codeChallenge: input.codeChallenge,
        expiresAt: new Date(now.getTime() + AUTHORIZATION_CODE_TTL_MS),
      })
      .execute();
  });
  return code;
};

/** Revokes both the access and refresh tokens for a grant or a refresh family. */
const revokeTokenPair = async (
  trx: DatabaseConnection,
  target: { grantId: string } | { familyId: string },
) => {
  const now = new Date();
  if ('grantId' in target) {
    await trx
      .updateTable('oauthAccessToken')
      .set({ revokedAt: now })
      .where('grantId', '=', target.grantId)
      .where('revokedAt', 'is', null)
      .execute();
    await trx
      .updateTable('oauthRefreshToken')
      .set({ revokedAt: now })
      .where('grantId', '=', target.grantId)
      .where('revokedAt', 'is', null)
      .execute();
    return;
  }
  await trx
    .updateTable('oauthRefreshToken')
    .set({ revokedAt: now })
    .where('familyId', '=', target.familyId)
    .where('revokedAt', 'is', null)
    .execute();
  await trx
    .updateTable('oauthAccessToken')
    .set({ revokedAt: now })
    .where('refreshFamilyId', '=', target.familyId)
    .where('revokedAt', 'is', null)
    .execute();
};

/*
 * RFC 7009: a client may revoke a token it was issued. Revoking an access token
 * invalidates that token; revoking a refresh token revokes its whole family --
 * the same unit `rotateRefreshToken` uses on reuse detection. Tokens issued to
 * another client are left untouched.
 */
export const revokeIssuedToken = async (rawToken: string, clientId: string) => {
  const hash = hashSha256(rawToken);
  await db.transaction().execute(async (trx) => {
    const access = await trx
      .selectFrom('oauthAccessToken')
      .select('tokenHash')
      .where('tokenHash', '=', hash)
      .where('clientId', '=', clientId)
      .executeTakeFirst();
    if (access) {
      await trx
        .updateTable('oauthAccessToken')
        .set({ revokedAt: new Date() })
        .where('tokenHash', '=', hash)
        .execute();
      return;
    }
    const refresh = await trx
      .selectFrom('oauthRefreshToken')
      .select('familyId')
      .where('tokenHash', '=', hash)
      .where('clientId', '=', clientId)
      .executeTakeFirst();
    if (refresh) await revokeTokenPair(trx, { familyId: refresh.familyId });
  });
};

export const consumeAuthorizationCode = async (input: {
  code: string;
  clientId: string;
  redirectUri: string;
  resource: string;
  verifier: string;
}) => {
  const row = await db.transaction().execute(async (trx) => {
    const found = await trx
      .selectFrom('oauthAuthorizationCode')
      .selectAll()
      .where('codeHash', '=', hashSha256(input.code))
      .forUpdate()
      .executeTakeFirst();
    if (!found || found.clientId !== input.clientId) return null;
    if (found.usedAt) {
      /*
       * The code was already redeemed. RFC 6749 4.1.2 requires revoking the
       * tokens it produced, because a replay means the code leaked. Only the
       * client it was issued to can trigger this, so a third party holding a
       * spent code cannot revoke someone else's grant.
       */
      await revokeTokenPair(trx, { grantId: found.grantId });
      return null;
    }
    if (
      found.expiresAt < new Date() ||
      found.redirectUri !== input.redirectUri ||
      found.resource !== input.resource ||
      pkceChallenge(input.verifier) !== found.codeChallenge
    )
      return null;
    const updated = await trx
      .updateTable('oauthAuthorizationCode')
      .set({ usedAt: new Date() })
      .where('codeHash', '=', found.codeHash)
      .where('usedAt', 'is', null)
      .returningAll()
      .executeTakeFirst();
    return updated ?? null;
  });
  return row;
};

type TokenGrant = {
  clientId: string;
  userId: string;
  grantId: string;
  scopes: ApiScope[];
  resource: string;
};

/** Writes one access/refresh pair. The only place token lifetimes are set. */
const insertTokenPair = async (
  trx: DatabaseConnection,
  grant: TokenGrant,
  familyId: string,
) => {
  const accessToken = randomOpaque();
  const refreshToken = randomOpaque();
  const now = Date.now();
  const shared = {
    clientId: grant.clientId,
    userId: grant.userId,
    grantId: grant.grantId,
    scopes: grant.scopes,
    resource: grant.resource,
  };
  await trx
    .insertInto('oauthAccessToken')
    .values({
      ...shared,
      tokenHash: hashSha256(accessToken),
      refreshFamilyId: familyId,
      expiresAt: new Date(now + ACCESS_TOKEN_TTL_MS),
    })
    .execute();
  await trx
    .insertInto('oauthRefreshToken')
    .values({
      ...shared,
      tokenHash: hashSha256(refreshToken),
      familyId,
      expiresAt: new Date(now + REFRESH_TOKEN_TTL_MS),
    })
    .execute();
  return {
    accessToken,
    refreshToken,
    expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
    scope: grant.scopes.join(' '),
    tokenType: 'Bearer' as const,
  };
};

export const issueTokens = async (grant: TokenGrant) =>
  db.transaction().execute((trx) => insertTokenPair(trx, grant, randomUUID()));

export const rotateRefreshToken = async (
  raw: string,
  resource: string,
  clientId: string,
) => {
  const hash = hashSha256(raw);
  return db.transaction().execute(async (trx) => {
    const token = await trx
      .selectFrom('oauthRefreshToken')
      .innerJoin('oauthGrant', 'oauthGrant.id', 'oauthRefreshToken.grantId')
      .selectAll('oauthRefreshToken')
      .select('oauthGrant.scopes as grantScopes')
      .where('oauthRefreshToken.tokenHash', '=', hash)
      .forUpdate()
      .executeTakeFirst();
    if (
      !token ||
      token.clientId !== clientId ||
      token.resource !== resource ||
      token.expiresAt < new Date() ||
      token.revokedAt
    )
      return null;
    if (token.usedAt) {
      await revokeTokenPair(trx, { familyId: token.familyId });
      return null;
    }
    await trx
      .updateTable('oauthRefreshToken')
      .set({ usedAt: new Date() })
      .where('tokenHash', '=', hash)
      .execute();
    return insertTokenPair(
      trx,
      {
        clientId: token.clientId,
        userId: token.userId,
        grantId: token.grantId,
        // Re-approving the client with fewer scopes narrows the family too.
        scopes: parseScopes(token.scopes).filter((scope) =>
          token.grantScopes.includes(scope),
        ),
        resource: token.resource,
      },
      token.familyId,
    );
  });
};

/*
 * There is no scheduler in this codebase, so expired rows are removed
 * opportunistically where they are created: /oauth/authorize and
 * /oauth/register, both unauthenticated. The same shape as
 * listUserShares/deleteExpiredShares.
 */
export const cleanupExpiredOAuthRecords = async () => {
  const now = new Date();
  await Promise.all([
    db
      .deleteFrom('oauthClient')
      .where('createdAt', '<', new Date(now.getTime() - UNUSED_CLIENT_TTL_MS))
      .where(({ not, exists, selectFrom }) =>
        not(
          exists(
            selectFrom('oauthGrant')
              .select('oauthGrant.id')
              .whereRef('oauthGrant.clientId', '=', 'oauthClient.id'),
          ),
        ),
      )
      .execute(),
    db
      .deleteFrom('oauthAuthorizationRequest')
      .where('expiresAt', '<', now)
      .execute(),
    db
      .deleteFrom('oauthAuthorizationCode')
      .where('expiresAt', '<', now)
      .execute(),
    db.deleteFrom('oauthAccessToken').where('expiresAt', '<', now).execute(),
    db.deleteFrom('oauthRefreshToken').where('expiresAt', '<', now).execute(),
  ]);
};
