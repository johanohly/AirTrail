import type { Kysely, Transaction } from 'kysely';
import { jsonArrayFrom } from 'kysely/helpers/postgres';

import { db } from '$lib/db';
import type { DB } from '$lib/db/schema';
import type { AuthorizationContext } from './context';
import { AuthorizationError, requireLockedPermissions } from './authorize';
import { actorCanAssignRole, RoleOperationError } from './roles';
import type {
  OAuthRoleMappingInput,
  OAuthRoleMappingMode,
} from '$lib/zod/oauth-role-mapping';

export type OAuthClaims = Record<string, unknown>;

export type OAuthRoleEvaluation =
  | { kind: 'matched'; roleId: string; ruleIndex: number }
  | { kind: 'fallback'; roleId: string };

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
  const isComparableClaim = (
    value: unknown,
  ): value is string | number | boolean =>
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean';

  if (operator === 'equals') {
    return isComparableClaim(actual) && String(actual) === expected;
  }
  if (typeof actual === 'string') return actual.includes(expected);
  return (
    Array.isArray(actual) &&
    actual.some(
      (value) => isComparableClaim(value) && String(value) === expected,
    )
  );
};

const findMatchingMappingIndex = (
  mappings: readonly OAuthRoleMappingInput[],
  userinfo: OAuthClaims,
  idToken: OAuthClaims,
) =>
  mappings.findIndex((candidate) => {
    if (!candidate.enabled) return false;
    const claims = candidate.claimSource === 'userinfo' ? userinfo : idToken;
    return matches(
      readJsonPointer(claims, candidate.claimPath),
      candidate.operator,
      candidate.claimValue,
    );
  });

export const selectOAuthMappedRole = (
  mappings: readonly OAuthRoleMappingInput[],
  userinfo: OAuthClaims,
  idToken: OAuthClaims,
) => {
  const ruleIndex = findMatchingMappingIndex(mappings, userinfo, idToken);
  return ruleIndex === -1 ? undefined : mappings[ruleIndex]!.roleId;
};

export const evaluateOAuthRoleMappings = ({
  mappings,
  userinfo,
  idToken,
  defaultRoleId,
}: {
  mappings: readonly OAuthRoleMappingInput[];
  userinfo: OAuthClaims;
  idToken: OAuthClaims;
  defaultRoleId: string;
}): OAuthRoleEvaluation => {
  const ruleIndex = findMatchingMappingIndex(mappings, userinfo, idToken);
  if (ruleIndex === -1) return { kind: 'fallback', roleId: defaultRoleId };
  return { kind: 'matched', roleId: mappings[ruleIndex]!.roleId, ruleIndex };
};

export const oauthAssignmentRoleIds = (
  defaultRoleId: string,
  mappings: readonly OAuthRoleMappingInput[],
) => [...new Set([defaultRoleId, ...mappings.map(({ roleId }) => roleId)])];

export const getOAuthRoleSettings = async (
  connection: DatabaseConnection = db,
) =>
  connection
    .selectFrom('authorizationSettings')
    .innerJoin(
      'accessRole as defaultRole',
      'defaultRole.id',
      'authorizationSettings.defaultRoleId',
    )
    .select([
      'authorizationSettings.defaultRoleId',
      'authorizationSettings.oauthRoleMappingMode',
      'defaultRole.name as defaultRoleName',
    ])
    .select(() =>
      jsonArrayFrom(
        connection
          .selectFrom('oauthRoleMapping')
          .selectAll()
          .orderBy('priority')
          .orderBy('id'),
      ).as('mappings'),
    )
    .where('authorizationSettings.id', '=', 1)
    .executeTakeFirstOrThrow();

export const getOAuthManagedUserCount = async (
  connection: DatabaseConnection = db,
) => {
  const result = await connection
    .selectFrom('user')
    .select((eb) => eb.fn.countAll().as('count'))
    .where('roleAssignmentSource', '=', 'oauth')
    .executeTakeFirstOrThrow();
  return Number(result.count);
};

export const testOAuthRoleMappings = async ({
  mappings,
  userinfo,
  idToken,
  connection = db,
}: {
  mappings: readonly OAuthRoleMappingInput[];
  userinfo: OAuthClaims;
  idToken: OAuthClaims;
  connection?: DatabaseConnection;
}) => {
  const settings = await connection
    .selectFrom('authorizationSettings')
    .select('defaultRoleId')
    .where('id', '=', 1)
    .executeTakeFirstOrThrow();
  const evaluation = evaluateOAuthRoleMappings({
    mappings,
    userinfo,
    idToken,
    defaultRoleId: settings.defaultRoleId,
  });
  const role = await connection
    .selectFrom('accessRole')
    .select('name')
    .where('id', '=', evaluation.roleId)
    .executeTakeFirst();
  if (!role) {
    throw new RoleOperationError(
      'not_found',
      'The resulting role no longer exists',
    );
  }
  return { ...evaluation, roleName: role.name };
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
  const evaluation = evaluateOAuthRoleMappings({
    mappings: settings.mappings,
    userinfo,
    idToken,
    defaultRoleId: settings.defaultRoleId,
  });
  return {
    roleId: evaluation.roleId,
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
    const currentAuthorization = await requireLockedPermissions({
      userId: authorization.userId,
      permissions: ['instance.oauth.manage'],
      transaction: trx,
    });
    const roleIds = oauthAssignmentRoleIds(settings.defaultRoleId, mappings);
    const roles = await trx
      .selectFrom('accessRole')
      .select('id')
      .where('id', 'in', roleIds)
      .forUpdate()
      .execute();
    if (roles.length !== roleIds.length) {
      throw new RoleOperationError(
        'not_found',
        'An OAuth role no longer exists',
      );
    }
    if (mode !== 'off') {
      if (
        !(await actorCanAssignRole(
          currentAuthorization,
          settings.defaultRoleId,
          trx,
        ))
      ) {
        throw new AuthorizationError(
          'The OAuth fallback cannot assign this role',
        );
      }
      for (const mapping of mappings) {
        if (
          !(await actorCanAssignRole(currentAuthorization, mapping.roleId, trx))
        ) {
          throw new AuthorizationError(
            'An OAuth mapping cannot assign this role',
          );
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
