import type { Transaction } from 'kysely';

import { db } from '$lib/db';
import type { DB } from '$lib/db/schema';
import type { AuthorizationContext } from './context';
import { actorCanAssignRole } from './roles';
import { writeAuthorizationAudit } from './audit';

export type OAuthRoleMappingMode = 'off' | 'on_create' | 'on_login';
export type OAuthClaims = Record<string, unknown>;
export type OAuthRoleMappingInput = {
  claimSource: 'userinfo' | 'id_token';
  claimPath: string;
  operator: 'equals' | 'contains';
  claimValue: string;
  roleId: string;
};

const decodePointerSegment = (segment: string) =>
  segment.replaceAll('~1', '/').replaceAll('~0', '~');

export const readJsonPointer = (value: unknown, pointer: string): unknown => {
  if (pointer === '') return value;
  if (!pointer.startsWith('/')) return undefined;
  return pointer
    .slice(1)
    .split('/')
    .map(decodePointerSegment)
    .reduce<unknown>((current, segment) => {
      if (Array.isArray(current)) {
        const index = Number(segment);
        return Number.isInteger(index) ? current[index] : undefined;
      }
      if (current && typeof current === 'object') {
        return (current as Record<string, unknown>)[segment];
      }
      return undefined;
    }, value);
};

const matches = (
  actual: unknown,
  operator: 'equals' | 'contains',
  expected: string,
) => {
  if (operator === 'equals') return String(actual) === expected;
  if (typeof actual === 'string') return actual.includes(expected);
  return (
    Array.isArray(actual) && actual.some((value) => String(value) === expected)
  );
};

export const selectOAuthMappedRole = (
  mappings: readonly OAuthRoleMappingInput[],
  userinfo: OAuthClaims,
  idToken: OAuthClaims,
) =>
  mappings.find((candidate) => {
    const claims = candidate.claimSource === 'userinfo' ? userinfo : idToken;
    return matches(
      readJsonPointer(claims, candidate.claimPath),
      candidate.operator,
      candidate.claimValue,
    );
  })?.roleId;

export const getOAuthRoleSettings = async () => {
  const [settings, mappings] = await Promise.all([
    db
      .selectFrom('authorizationSettings')
      .select(['defaultRoleId', 'oauthRoleMappingMode'])
      .where('id', '=', 1)
      .executeTakeFirstOrThrow(),
    db
      .selectFrom('oauthRoleMapping')
      .selectAll()
      .orderBy('priority')
      .orderBy('id')
      .execute(),
  ]);
  return { ...settings, mappings };
};

export const resolveOAuthRole = async (
  userinfo: OAuthClaims,
  idToken: OAuthClaims,
) => {
  const settings = await getOAuthRoleSettings();
  if (settings.oauthRoleMappingMode === 'off') {
    return {
      roleId: settings.defaultRoleId,
      mode: settings.oauthRoleMappingMode,
    };
  }
  const roleId = selectOAuthMappedRole(settings.mappings, userinfo, idToken);
  return {
    roleId: roleId ?? settings.defaultRoleId,
    mode: settings.oauthRoleMappingMode,
  };
};

export const replaceOAuthRoleSettings = async (
  mode: OAuthRoleMappingMode,
  mappings: OAuthRoleMappingInput[],
  authorization: AuthorizationContext,
) => {
  for (const mapping of mappings) {
    if (!(await actorCanAssignRole(authorization, mapping.roleId))) {
      throw new Error('An OAuth mapping cannot assign this role');
    }
  }

  await db.transaction().execute(async (trx: Transaction<DB>) => {
    const before = await getOAuthRoleSettings();
    await trx
      .updateTable('authorizationSettings')
      .set({ oauthRoleMappingMode: mode })
      .where('id', '=', 1)
      .execute();
    await trx.deleteFrom('oauthRoleMapping').execute();
    if (mappings.length) {
      await trx
        .insertInto('oauthRoleMapping')
        .values(
          mappings.map((mapping, priority) => ({
            ...mapping,
            priority,
          })),
        )
        .execute();
    }
    await writeAuthorizationAudit(
      {
        actorUserId: authorization.userId,
        action: 'oauth_role_mappings.updated',
        targetType: 'authorization_settings',
        targetId: '1',
        before,
        after: { mode, mappings },
      },
      trx,
    );
  });
};
