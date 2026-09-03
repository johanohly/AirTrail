import { db } from '$lib/db';
import { isApiScope, type ApiScope } from '$lib/api/v1/scopes';
import type { User } from '$lib/db/types';
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

const validScopes = (scopes: readonly string[]) =>
  new Set(scopes.filter(isApiScope));

const userFields = [
  'user.id',
  'user.username',
  'user.displayName',
  'user.roleId',
  'user.isOwner',
  'user.roleAssignmentSource',
  'user.oauthId',
  'user.distanceUnit',
  'user.windSpeedUnit',
  'user.temperatureUnit',
  'user.pressureUnit',
  'user.timeFormat',
  'user.dateFormat',
  'user.weekStartsOn',
  'user.flightTimeDisplay',
] as const;

const toUser = (row: {
  id: string;
  username: string;
  displayName: string;
  roleId: string | null;
  isOwner: boolean;
  roleAssignmentSource: 'local' | 'oauth';
  oauthId: string | null;
  distanceUnit: User['distanceUnit'];
  windSpeedUnit: User['windSpeedUnit'];
  temperatureUnit: User['temperatureUnit'];
  pressureUnit: User['pressureUnit'];
  timeFormat: User['timeFormat'];
  dateFormat: User['dateFormat'];
  weekStartsOn: User['weekStartsOn'];
  flightTimeDisplay: User['flightTimeDisplay'];
}): User => row;

export const authenticateApiPrincipal = async (
  request: Request,
  expectedResource?: string,
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
        scopes: validScopes(apiKey.scopes),
      },
    };
  }

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
    .where('oauthAccessToken.expiresAt', '>', new Date())
    .where('oauthAccessToken.revokedAt', 'is', null)
    .executeTakeFirst();

  if (!token || (expectedResource && token.resource !== expectedResource)) {
    return null;
  }
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
      scopes: validScopes(token.scopes),
    },
  };
};

export const principalHasScope = (principal: ApiPrincipal, scope: ApiScope) => {
  if (principal.credential.scopes.has(scope)) return true;
  const broader = scope.endsWith('.own')
    ? (`${scope.slice(0, -4)}.any` as ApiScope)
    : null;
  return broader ? principal.credential.scopes.has(broader) : false;
};
