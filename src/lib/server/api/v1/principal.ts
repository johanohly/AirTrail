import { db } from '$lib/db';
import { parseScopes, scopeSetCovers, type ApiScope } from '$lib/api/v1/scopes';
import { publicUserFields, type User } from '$lib/db/types';
import {
  loadAuthorizationContext,
  type AuthorizationContext,
} from '$lib/server/authorization/context';
import { hashSha256 } from '$lib/server/utils/hash';

export type ApiCredential =
  | {
      kind: 'apiKey';
      keyId: number;
      scopes: ReadonlySet<ApiScope>;
    }
  | {
      kind: 'oauth';
      clientId: string;
      grantId: string;
      resource: string;
      scopes: ReadonlySet<ApiScope>;
    };

export type ApiPrincipal = {
  user: User;
  authorization: AuthorizationContext;
  credential: ApiCredential;
};

const parseBearer = (request: Request) => {
  const value = request.headers.get('Authorization');
  if (!value) return null;
  const match = /^Bearer[ \t]+([^ \t]+)$/i.exec(value);
  return match?.[1] ?? null;
};

/*
 * The columns that make up a `User`. `_NoUnselectedUserColumns` fails to
 * compile if a column is added to `User` without being selected here.
 */
const userColumns = [
  ...publicUserFields,
  'oauthId',
] as const satisfies readonly (keyof User)[];

type AssertNever<T extends never> = T;
type _NoUnselectedUserColumns = AssertNever<
  Exclude<keyof User, (typeof userColumns)[number]>
>;

const qualify = <const Fields extends readonly string[]>(fields: Fields) =>
  fields.map((field) => `user.${field}`) as {
    -readonly [K in keyof Fields]: `user.${Fields[K] & string}`;
  };

const userFields = qualify(userColumns);

/** Projects only the user columns, so credential fields cannot ride along. */
const toUser = (row: Record<string, unknown>): User =>
  Object.fromEntries(
    userColumns.map((column) => [column, row[column]]),
  ) as unknown as User;

/**
 * Resolves the bearer credential. OAuth access tokens are accepted only for the
 * resource they were issued to; pass `null` to accept API keys alone.
 */
export const authenticateApiPrincipal = async (
  request: Request,
  resource: string | null,
): Promise<ApiPrincipal | null> => {
  const rawToken = parseBearer(request);
  if (!rawToken) return null;

  const hash = hashSha256(rawToken);
  const apiKey = await db
    .selectFrom('apiKey')
    .innerJoin('user', 'user.id', 'apiKey.userId')
    .select([
      'apiKey.id as keyId',
      'apiKey.userId',
      'apiKey.scopes',
      ...userFields,
    ])
    .where('apiKey.key', '=', hash)
    .executeTakeFirst();

  if (apiKey) {
    const authorization = await loadAuthorizationContext(apiKey.userId);
    if (!authorization) return null;

    await db
      .updateTable('apiKey')
      .set({ lastUsed: new Date() })
      .where('id', '=', apiKey.keyId)
      .execute();

    return {
      user: toUser(apiKey),
      authorization,
      credential: {
        kind: 'apiKey',
        keyId: apiKey.keyId,
        scopes: new Set(parseScopes(apiKey.scopes)),
      },
    };
  }

  if (resource === null) return null;
  const token = await db
    .selectFrom('oauthAccessToken')
    .innerJoin('user', 'user.id', 'oauthAccessToken.userId')
    .select([
      'oauthAccessToken.clientId',
      'oauthAccessToken.userId',
      'oauthAccessToken.grantId',
      'oauthAccessToken.resource',
      'oauthAccessToken.scopes',
      ...userFields,
    ])
    .where('oauthAccessToken.tokenHash', '=', hash)
    .where('oauthAccessToken.resource', '=', resource)
    .where('oauthAccessToken.expiresAt', '>', new Date())
    .where('oauthAccessToken.revokedAt', 'is', null)
    .executeTakeFirst();

  if (!token) return null;
  const authorization = await loadAuthorizationContext(token.userId);
  if (!authorization) return null;

  return {
    user: toUser(token),
    authorization,
    credential: {
      kind: 'oauth',
      clientId: token.clientId,
      grantId: token.grantId,
      resource: token.resource,
      scopes: new Set(parseScopes(token.scopes)),
    },
  };
};

export const principalHasScope = (principal: ApiPrincipal, scope: ApiScope) =>
  scopeSetCovers(principal.credential.scopes, scope);
