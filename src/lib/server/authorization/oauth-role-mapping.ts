import type { Kysely, Transaction } from 'kysely';

import { db } from '$lib/db';
import type { DB } from '$lib/db/schema';
import type { AuthorizationContext } from './context';
import { loadLockedAuthorizationContext } from './context';
import { hasPermission } from './authorize';
import { actorCanAssignRole } from './roles';
import type {
  OAuthRoleMappingInput,
  OAuthRoleMappingMode,
} from '$lib/zod/oauth-role-mapping';

export type OAuthClaims = Record<string, unknown>;

type DatabaseConnection = Kysely<DB> | Transaction<DB>;

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

export const oauthAssignmentRoleIds = (
  defaultRoleId: string,
  mappings: readonly OAuthRoleMappingInput[],
) => [...new Set([defaultRoleId, ...mappings.map(({ roleId }) => roleId)])];

export const getOAuthRoleSettings = async (
  connection: DatabaseConnection = db,
) => {
  const [settings, mappings] = await Promise.all([
    connection
      .selectFrom('authorizationSettings')
      .select(['defaultRoleId', 'oauthRoleMappingMode'])
      .where('id', '=', 1)
      .executeTakeFirstOrThrow(),
    connection
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

export const updateOAuthManagedUserRole = async (
  userId: string,
  roleId: string,
  connection: DatabaseConnection = db,
) =>
  connection
    .updateTable('user')
    .set({ roleId })
    .where('id', '=', userId)
    .where('roleAssignmentSource', '=', 'oauth')
    .returningAll()
    .executeTakeFirst();

export const replaceOAuthRoleSettings = async (
  mode: OAuthRoleMappingMode,
  mappings: OAuthRoleMappingInput[],
  authorization: AuthorizationContext,
) => {
  await db.transaction().execute(async (trx) => {
    const settings = await trx
      .selectFrom('authorizationSettings')
      .select(['defaultRoleId', 'oauthRoleMappingMode'])
      .where('id', '=', 1)
      .forUpdate()
      .executeTakeFirstOrThrow();
    const currentAuthorization = await loadLockedAuthorizationContext(
      authorization.userId,
      trx,
    );
    if (
      !currentAuthorization ||
      !hasPermission(currentAuthorization, 'instance.oauth.manage')
    ) {
      throw new Error('You cannot manage OAuth role mappings');
    }
    const roleIds = oauthAssignmentRoleIds(settings.defaultRoleId, mappings);
    const roles = await trx
      .selectFrom('accessRole')
      .select('id')
      .where('id', 'in', roleIds)
      .forUpdate()
      .execute();
    if (roles.length !== roleIds.length) {
      throw new Error('An OAuth role no longer exists');
    }
    if (mode !== 'off') {
      if (
        !(await actorCanAssignRole(
          currentAuthorization,
          settings.defaultRoleId,
          trx,
        ))
      ) {
        throw new Error('The OAuth fallback cannot assign this role');
      }
      for (const mapping of mappings) {
        if (
          !(await actorCanAssignRole(currentAuthorization, mapping.roleId, trx))
        ) {
          throw new Error('An OAuth mapping cannot assign this role');
        }
      }
    }

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
  });
};
