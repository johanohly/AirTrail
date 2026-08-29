import { generateId } from 'lucia';
import { sql, type Kysely, type Transaction } from 'kysely';

import { isPermission, type Permission } from '$lib/authorization/permissions';
import { db } from '$lib/db';
import type { DB } from '$lib/db/schema';
import type { AuthorizationContext } from './context';
import { loadLockedAuthorizationContext } from './context';
import { hasPermission, permissionsAreSubset } from './authorize';
import type { RoleInput } from '$lib/zod/role';

type DatabaseConnection = Kysely<DB> | Transaction<DB>;

export const listRoles = async (connection: DatabaseConnection = db) => {
  const [roles, grants, settings, counts] = await Promise.all([
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

  return roles.map((role) => ({
    ...role,
    permissions: permissionsByRole.get(role.id) ?? [],
    userCount: countByRole.get(role.id) ?? 0,
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
  const ids = [...new Set(roleIds.filter((roleId) => roleId !== null))].sort();
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
    throw new Error('A role cannot grant permissions you do not have');
  }
  if (await roleNameExists(input.name, connection, excludeId)) {
    throw new Error('A role with this name already exists');
  }
};

export const createRole = async (
  input: RoleInput,
  authorization: AuthorizationContext,
) => {
  const id = generateId(15);
  await db.transaction().execute(async (trx) => {
    const currentAuthorization = await loadLockedAuthorizationContext(
      authorization.userId,
      trx,
    );
    if (
      !currentAuthorization ||
      !hasPermission(currentAuthorization, 'roles.manage')
    ) {
      throw new Error('You cannot create roles');
    }
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
    const currentAuthorization = await loadLockedAuthorizationContext(
      authorization.userId,
      trx,
    );
    if (
      !currentAuthorization ||
      !hasPermission(currentAuthorization, 'roles.manage')
    ) {
      throw new Error('You cannot edit roles');
    }
    const role = await trx
      .selectFrom('accessRole')
      .select('id')
      .where('id', '=', roleId)
      .forUpdate()
      .executeTakeFirst();
    if (!role) throw new Error('Role not found');

    const beforePermissions = await getRolePermissions(roleId, trx);
    if (!permissionsAreSubset(beforePermissions, currentAuthorization)) {
      throw new Error(
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
    const currentAuthorization = await loadLockedAuthorizationContext(
      authorization.userId,
      trx,
    );
    if (
      !currentAuthorization ||
      !hasPermission(currentAuthorization, 'roles.manage')
    ) {
      throw new Error('You cannot set the default role');
    }
    const role = await trx
      .selectFrom('accessRole')
      .select('id')
      .where('id', '=', roleId)
      .forUpdate()
      .executeTakeFirst();
    if (!role) throw new Error('Role not found');
    if (
      !permissionsAreSubset(
        await getRolePermissions(roleId, trx),
        currentAuthorization,
      )
    ) {
      throw new Error('You cannot make this role the default');
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
    const currentAuthorization = await loadLockedAuthorizationContext(
      authorization.userId,
      trx,
    );
    if (
      !currentAuthorization ||
      !hasPermission(currentAuthorization, 'roles.manage')
    ) {
      throw new Error('You cannot delete roles');
    }
    const role = await trx
      .selectFrom('accessRole')
      .selectAll()
      .where('id', '=', roleId)
      .forUpdate()
      .executeTakeFirst();
    if (!role) return false;

    const permissions = await getRolePermissions(roleId, trx);
    if (!permissionsAreSubset(permissions, currentAuthorization)) {
      throw new Error(
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
      throw new Error('Choose another default role first');
    }
    if (user) throw new Error('Reassign this role’s users first');

    const result = await trx
      .deleteFrom('accessRole')
      .where('id', '=', roleId)
      .executeTakeFirst();
    return Number(result.numDeletedRows) > 0;
  });
