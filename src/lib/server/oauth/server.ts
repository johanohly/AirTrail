import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { db } from '$lib/db';
import { hashArgon2, hashSha256 } from '$lib/server/utils/hash';
import { isApiScope, type ApiScope } from '$lib/api/v1/scopes';

export const oauthScopes = (values: readonly string[]) =>
  [...new Set(values.filter(isApiScope))] as ApiScope[];

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
  const grantId = randomUUID();
  const now = new Date();
  await db.transaction().execute(async (trx) => {
    const grant = await trx
      .selectFrom('oauthGrant')
      .select('id')
      .where('clientId', '=', input.clientId)
      .where('userId', '=', input.userId)
      .where('resource', '=', input.resource)
      .executeTakeFirst();
    const actualGrantId = grant?.id ?? grantId;
    if (!grant)
      await trx
        .insertInto('oauthGrant')
        .values({
          id: actualGrantId,
          clientId: input.clientId,
          userId: input.userId,
          resource: input.resource,
          scopes: input.scopes,
        })
        .execute();
    else
      await trx
        .updateTable('oauthGrant')
        .set({ scopes: input.scopes, updatedAt: now })
        .where('id', '=', actualGrantId)
        .execute();
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
        expiresAt: new Date(now.getTime() + 60_000),
      })
      .execute();
  });
  return code;
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
    if (
      !found ||
      found.usedAt ||
      found.expiresAt < new Date() ||
      found.clientId !== input.clientId ||
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

export const issueTokens = async (code: {
  clientId: string;
  userId: string;
  grantId: string;
  scopes: string[];
  resource: string;
}) => {
  const accessToken = randomOpaque();
  const refreshToken = randomOpaque();
  const familyId = randomUUID();
  const now = new Date();
  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto('oauthAccessToken')
      .values({
        tokenHash: hashSha256(accessToken),
        clientId: code.clientId,
        userId: code.userId,
        grantId: code.grantId,
        refreshFamilyId: familyId,
        scopes: code.scopes,
        resource: code.resource,
        expiresAt: new Date(now.getTime() + 3_600_000),
      })
      .execute();
    await trx
      .insertInto('oauthRefreshToken')
      .values({
        tokenHash: hashSha256(refreshToken),
        clientId: code.clientId,
        userId: code.userId,
        grantId: code.grantId,
        familyId,
        scopes: code.scopes,
        resource: code.resource,
        expiresAt: new Date(now.getTime() + 30 * 24 * 3_600_000),
      })
      .execute();
  });
  return {
    accessToken,
    refreshToken,
    expiresIn: 3600,
    scope: code.scopes.join(' '),
    tokenType: 'Bearer' as const,
  };
};

export const rotateRefreshToken = async (
  raw: string,
  resource: string,
  clientId: string,
) => {
  const hash = hashSha256(raw);
  return db.transaction().execute(async (trx) => {
    const token = await trx
      .selectFrom('oauthRefreshToken')
      .selectAll()
      .where('tokenHash', '=', hash)
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
      await trx
        .updateTable('oauthRefreshToken')
        .set({ revokedAt: new Date() })
        .where('familyId', '=', token.familyId)
        .execute();
      await trx
        .updateTable('oauthAccessToken')
        .set({ revokedAt: new Date() })
        .where('refreshFamilyId', '=', token.familyId)
        .execute();
      return null;
    }
    await trx
      .updateTable('oauthRefreshToken')
      .set({ usedAt: new Date() })
      .where('tokenHash', '=', hash)
      .execute();
    const accessToken = randomOpaque();
    const refreshToken = randomOpaque();
    await trx
      .insertInto('oauthAccessToken')
      .values({
        tokenHash: hashSha256(accessToken),
        clientId: token.clientId,
        userId: token.userId,
        grantId: token.grantId,
        refreshFamilyId: token.familyId,
        scopes: token.scopes,
        resource: token.resource,
        expiresAt: new Date(Date.now() + 3_600_000),
      })
      .execute();
    await trx
      .insertInto('oauthRefreshToken')
      .values({
        tokenHash: hashSha256(refreshToken),
        clientId: token.clientId,
        userId: token.userId,
        grantId: token.grantId,
        familyId: token.familyId,
        scopes: token.scopes,
        resource: token.resource,
        expiresAt: new Date(Date.now() + 30 * 24 * 3_600_000),
      })
      .execute();
    return {
      accessToken,
      refreshToken,
      expiresIn: 3600,
      scope: token.scopes.join(' '),
      tokenType: 'Bearer' as const,
    };
  });
};
