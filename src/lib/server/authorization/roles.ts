import { generateId } from 'lucia';
import { sql } from 'kysely';

import { PERMISSIONS, type Permission } from '$lib/authorization/permissions';
import { db } from '$lib/db';
import type { AuthorizationContext } from './context';
import { hasPermission, permissionsAreSubset } from './authorize';
import { writeAuthorizationAudit } from './audit';

export type RoleInput = {
  name: string;
  description?: string | null;
  permissions: Permission[];
};

export const listRoles = async () => {
  const [roles, grants, settings, counts] = await Promise.all([
    db.selectFrom('accessRole').selectAll().orderBy('name').execute(),
    db.selectFrom('accessRolePermission').selectAll().execute(),
    db
      .selectFrom('authorizationSettings')
      .select('defaultRoleId')
      .where('id', '=', 1)
      .executeTakeFirstOrThrow(),
    db
      .selectFrom('user')
      .select(['roleId', (eb) => eb.fn.count('id').as('count')])
      .where('roleId', 'is not', null)
      .groupBy('roleId')
      .execute(),
  ]);
  const permissionsByRole = new Map<string, Permission[]>();
  for (const grant of grants) {
    if (!PERMISSIONS.includes(grant.permission as Permission)) continue;
    const values = permissionsByRole.get(grant.roleId) ?? [];
    values.push(grant.permission as Permission);
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

export const getRolePermissions = async (roleId: string) =>
  (
    await db
      .selectFrom('accessRolePermission')
      .select('permission')
      .where('roleId', '=', roleId)
      .execute()
  )
    .map(({ permission }) => permission)
    .filter((permission): permission is Permission =>
      PERMISSIONS.includes(permission as Permission),
    );

export const actorCanAssignRole = async (
  authorization: AuthorizationContext,
  roleId: string,
) => {
  if (!hasPermission(authorization, 'users.roles.assign')) return false;
  const permissions = await getRolePermissions(roleId);
  return permissionsAreSubset(permissions, authorization);
};

const roleNameExists = async (name: string, excludeId?: string) => {
  let query = db
    .selectFrom('accessRole')
    .select('id')
    .where(sql<boolean>`lower("name") = lower(${name})`);
  if (excludeId) query = query.where('id', '!=', excludeId);
  return Boolean(await query.executeTakeFirst());
};

const validateRoleInput = async (
  input: RoleInput,
  authorization: AuthorizationContext,
  excludeId?: string,
) => {
  if (!permissionsAreSubset(input.permissions, authorization)) {
    throw new Error('A role cannot grant permissions you do not have');
  }
  if (await roleNameExists(input.name, excludeId)) {
    throw new Error('A role with this name already exists');
  }
};

export const createRole = async (
  input: RoleInput,
  authorization: AuthorizationContext,
) => {
  await validateRoleInput(input, authorization);
  const id = generateId(15);
  await db.transaction().execute(async (trx) => {
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
    await writeAuthorizationAudit(
      {
        actorUserId: authorization.userId,
        action: 'role.created',
        targetType: 'role',
        targetId: id,
        after: input,
      },
      trx,
    );
  });
  return id;
};

export const updateRole = async (
  roleId: string,
  input: RoleInput,
  authorization: AuthorizationContext,
) => {
  await validateRoleInput(input, authorization, roleId);
  const before = (await listRoles()).find((role) => role.id === roleId);
  if (!before) throw new Error('Role not found');
  if (!permissionsAreSubset(before.permissions, authorization)) {
    throw new Error('You cannot edit a role with permissions you do not have');
  }

  await db.transaction().execute(async (trx) => {
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
    await writeAuthorizationAudit(
      {
        actorUserId: authorization.userId,
        action: 'role.updated',
        targetType: 'role',
        targetId: roleId,
        before,
        after: input,
      },
      trx,
    );
  });
};

export const setDefaultRole = async (
  roleId: string,
  authorization: AuthorizationContext,
) => {
  if (!permissionsAreSubset(await getRolePermissions(roleId), authorization)) {
    throw new Error('You cannot make this role the default');
  }
  await db.transaction().execute(async (trx) => {
    const settings = await trx
      .selectFrom('authorizationSettings')
      .select('defaultRoleId')
      .where('id', '=', 1)
      .forUpdate()
      .executeTakeFirstOrThrow();
    const role = await trx
      .selectFrom('accessRole')
      .select('id')
      .where('id', '=', roleId)
      .executeTakeFirst();
    if (!role) throw new Error('Role not found');
    await trx
      .updateTable('authorizationSettings')
      .set({ defaultRoleId: roleId })
      .where('id', '=', 1)
      .execute();
    await writeAuthorizationAudit(
      {
        actorUserId: authorization.userId,
        action: 'role.default_changed',
        targetType: 'role',
        targetId: roleId,
        before: { roleId: settings.defaultRoleId },
        after: { roleId },
      },
      trx,
    );
  });
};

export const deleteRole = async (
  roleId: string,
  authorization: AuthorizationContext,
) => {
  const role = (await listRoles()).find((candidate) => candidate.id === roleId);
  if (!role) return false;
  if (!permissionsAreSubset(role.permissions, authorization)) {
    throw new Error(
      'You cannot delete a role with permissions you do not have',
    );
  }
  if (role.isDefault) throw new Error('Choose another default role first');
  if (role.userCount) throw new Error('Reassign this role’s users first');

  return await db.transaction().execute(async (trx) => {
    const result = await trx
      .deleteFrom('accessRole')
      .where('id', '=', roleId)
      .executeTakeFirst();
    await writeAuthorizationAudit(
      {
        actorUserId: authorization.userId,
        action: 'role.deleted',
        targetType: 'role',
        targetId: roleId,
        before: role,
      },
      trx,
    );
    return Number(result.numDeletedRows) > 0;
  });
};
