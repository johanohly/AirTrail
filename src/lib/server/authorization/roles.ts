import { generateId } from 'lucia';
import { sql, type Kysely, type Transaction } from 'kysely';

import { isPermission, type Permission } from '$lib/authorization/permissions';
import { db } from '$lib/db';
import type { DB } from '$lib/db/schema';
import type { AuthorizationContext } from './context';
import {
  AuthorizationError,
  hasPermission,
  permissionsAreSubset,
  requireLockedPermissions,
} from './authorize';
import type { RoleInput } from '$lib/zod/role';

type DatabaseConnection = Kysely<DB> | Transaction<DB>;

type RoleOperationErrorKind = 'conflict' | 'invalid' | 'not_found';

export class RoleOperationError extends Error {
  constructor(
    public readonly kind: RoleOperationErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'RoleOperationError';
  }
}

export const listRoles = async (connection: DatabaseConnection = db) => {
  const [roles, grants, settings, counts, oauthMappingCounts] =
    await Promise.all([
      connection.selectFrom('accessRole').selectAll().orderBy('name').execute(),
      connection.selectFrom('accessRolePermission').selectAll().execute(),
      connection
        .selectFrom('authorizationSettings')
        .select('defaultRoleId')
        .where('id', '=', 1)
        .executeTakeFirstOrThrow(),
      connection
        .selectFrom('user')
        .select(['roleId', (eb) => eb.fn.count('id').as('count')])
        .where('roleId', 'is not', null)
        .groupBy('roleId')
        .execute(),
      connection
        .selectFrom('oauthRoleMapping')
        .select(['roleId', (eb) => eb.fn.count('id').as('count')])
        .groupBy('roleId')
        .execute(),
    ]);
  const permissionsByRole = new Map<string, Permission[]>();
  for (const grant of grants) {
    if (!isPermission(grant.permission)) continue;
    const values = permissionsByRole.get(grant.roleId) ?? [];
    values.push(grant.permission);
    permissionsByRole.set(grant.roleId, values);
  }
  const countByRole = new Map(
    counts.map(({ roleId, count }) => [roleId, Number(count)]),
  );
  const oauthMappingCountByRole = new Map(
    oauthMappingCounts.map(({ roleId, count }) => [roleId, Number(count)]),
  );

  return roles.map((role) => ({
    ...role,
    permissions: permissionsByRole.get(role.id) ?? [],
    userCount: countByRole.get(role.id) ?? 0,
    oauthMappingCount: oauthMappingCountByRole.get(role.id) ?? 0,
    isDefault: role.id === settings.defaultRoleId,
  }));
};

export const getRolePermissions = async (
  roleId: string,
  connection: DatabaseConnection = db,
) =>
  (
    await connection
      .selectFrom('accessRolePermission')
      .select('permission')
      .where('roleId', '=', roleId)
      .execute()
  )
    .map(({ permission }) => permission)
    .filter(isPermission);

export const lockRoles = async (
  transaction: Transaction<DB>,
  roleIds: readonly (string | null)[],
) => {
  const ids = [...new Set(roleIds.filter((roleId) => roleId !== null))].sort(
    (left, right) => left.localeCompare(right),
  );
  if (ids.length === 0) return;
  const roles = await transaction
    .selectFrom('accessRole')
    .select('id')
    .where('id', 'in', ids)
    .orderBy('id')
    .forUpdate()
    .execute();
  if (roles.length !== ids.length) throw new Error('Role not found');
};

export const actorCanAssignRole = async (
  authorization: AuthorizationContext,
  roleId: string,
  connection: DatabaseConnection = db,
) => {
  if (!hasPermission(authorization, 'users.roles.assign')) return false;
  const permissions = await getRolePermissions(roleId, connection);
  return permissionsAreSubset(permissions, authorization);
};

export const listAssignableRoleOptions = async (
  authorization: AuthorizationContext,
) => {
  if (!hasPermission(authorization, 'users.roles.assign')) return [];
  const roles = await listRoles();
  return roles
    .filter(({ permissions }) =>
      permissionsAreSubset(permissions, authorization),
    )
    .map(({ id, name, isDefault }) => ({ id, name, isDefault }));
};

export const listRoleOptions = async () =>
  db.selectFrom('accessRole').select(['id', 'name']).orderBy('name').execute();

const roleNameExists = async (
  name: string,
  connection: DatabaseConnection,
  excludeId?: string,
) => {
  let query = connection
    .selectFrom('accessRole')
    .select('id')
    .where(sql<boolean>`lower("name") = lower(${name})`);
  if (excludeId) query = query.where('id', '!=', excludeId);
  return Boolean(await query.executeTakeFirst());
};

const validateRoleInput = async (
  input: RoleInput,
  authorization: AuthorizationContext,
  connection: DatabaseConnection,
  excludeId?: string,
) => {
  if (!permissionsAreSubset(input.permissions, authorization)) {
    throw new AuthorizationError(
      'A role cannot grant permissions you do not have',
    );
  }
  if (await roleNameExists(input.name, connection, excludeId)) {
    throw new RoleOperationError(
      'conflict',
      'A role with this name already exists',
    );
  }
};

export const createRole = async (
  input: RoleInput,
  authorization: AuthorizationContext,
) => {
  const id = generateId(15);
  await db.transaction().execute(async (trx) => {
    const currentAuthorization = await requireLockedPermissions({
      userId: authorization.userId,
      permissions: ['roles.manage'],
      transaction: trx,
    });
    await validateRoleInput(input, currentAuthorization, trx);
    await trx
      .insertInto('accessRole')
      .values({
        id,
        name: input.name,
        description: input.description ?? null,
      })
      .execute();
    if (input.permissions.length) {
      await trx
        .insertInto('accessRolePermission')
        .values(
          [...new Set(input.permissions)].map((permission) => ({
            roleId: id,
            permission,
          })),
        )
        .execute();
    }
  });
  return id;
};

export const updateRole = async (
  roleId: string,
  input: RoleInput,
  authorization: AuthorizationContext,
) => {
  await db.transaction().execute(async (trx) => {
    const currentAuthorization = await requireLockedPermissions({
      userId: authorization.userId,
      permissions: ['roles.manage'],
      transaction: trx,
    });
    const role = await trx
      .selectFrom('accessRole')
      .select('id')
      .where('id', '=', roleId)
      .forUpdate()
      .executeTakeFirst();
    if (!role) throw new RoleOperationError('not_found', 'Role not found');

    const beforePermissions = await getRolePermissions(roleId, trx);
    if (!permissionsAreSubset(beforePermissions, currentAuthorization)) {
      throw new AuthorizationError(
        'You cannot edit a role with permissions you do not have',
      );
    }
    await validateRoleInput(input, currentAuthorization, trx, roleId);

    await trx
      .updateTable('accessRole')
      .set({
        name: input.name,
        description: input.description ?? null,
        updatedAt: new Date(),
      })
      .where('id', '=', roleId)
      .executeTakeFirstOrThrow();
    await trx
      .deleteFrom('accessRolePermission')
      .where('roleId', '=', roleId)
      .execute();
    if (input.permissions.length) {
      await trx
        .insertInto('accessRolePermission')
        .values(
          [...new Set(input.permissions)].map((permission) => ({
            roleId,
            permission,
          })),
        )
        .execute();
    }
  });
};

export const setDefaultRole = async (
  roleId: string,
  authorization: AuthorizationContext,
) => {
  await db.transaction().execute(async (trx) => {
    await trx
      .selectFrom('authorizationSettings')
      .select('id')
      .where('id', '=', 1)
      .forUpdate()
      .executeTakeFirstOrThrow();
    const currentAuthorization = await requireLockedPermissions({
      userId: authorization.userId,
      permissions: [
        'roles.manage',
        'users.roles.assign',
        'instance.oauth.manage',
      ],
      transaction: trx,
    });
    const role = await trx
      .selectFrom('accessRole')
      .select('id')
      .where('id', '=', roleId)
      .forUpdate()
      .executeTakeFirst();
    if (!role) throw new RoleOperationError('not_found', 'Role not found');
    if (!(await actorCanAssignRole(currentAuthorization, roleId, trx))) {
      throw new AuthorizationError('You cannot make this role the default');
    }
    await trx
      .updateTable('authorizationSettings')
      .set({ defaultRoleId: roleId })
      .where('id', '=', 1)
      .execute();
  });
};

export const deleteRole = async (
  roleId: string,
  authorization: AuthorizationContext,
) =>
  db.transaction().execute(async (trx) => {
    const settings = await trx
      .selectFrom('authorizationSettings')
      .select('defaultRoleId')
      .where('id', '=', 1)
      .forUpdate()
      .executeTakeFirstOrThrow();
    const currentAuthorization = await requireLockedPermissions({
      userId: authorization.userId,
      permissions: ['roles.manage'],
      transaction: trx,
    });
    const role = await trx
      .selectFrom('accessRole')
      .selectAll()
      .where('id', '=', roleId)
      .forUpdate()
      .executeTakeFirst();
    if (!role) return false;

    const permissions = await getRolePermissions(roleId, trx);
    if (!permissionsAreSubset(permissions, currentAuthorization)) {
      throw new AuthorizationError(
        'You cannot delete a role with permissions you do not have',
      );
    }

    const user = await trx
      .selectFrom('user')
      .select('id')
      .where('roleId', '=', roleId)
      .limit(1)
      .executeTakeFirst();
    if (settings.defaultRoleId === roleId) {
      throw new RoleOperationError(
        'invalid',
        'Choose another default role first',
      );
    }
    if (user) {
      throw new RoleOperationError(
        'invalid',
        'Reassign this role’s users first',
      );
    }
    const oauthMapping = await trx
      .selectFrom('oauthRoleMapping')
      .select('id')
      .where('roleId', '=', roleId)
      .limit(1)
      .executeTakeFirst();
    if (oauthMapping) {
      throw new RoleOperationError(
        'invalid',
        'Remove this role from OAuth mappings first',
      );
    }

    const result = await trx
      .deleteFrom('accessRole')
      .where('id', '=', roleId)
      .executeTakeFirst();
    return Number(result.numDeletedRows) > 0;
  });
