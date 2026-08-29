import type { Kysely, Transaction } from 'kysely';

import {
  isPermission,
  permissionsStrictlyInclude,
  type Permission,
} from '$lib/authorization/permissions';
import { db } from '$lib/db';
import type { DB } from '$lib/db/schema';
import type { DirectoryUser } from '$lib/db/types';
import { publicUserQuery } from '$lib/server/utils/user';
import type { AuthorizationContext } from './context';
import { getRolePermissions } from './roles';
import { hasPermission } from './authorize';

type DatabaseConnection = Kysely<DB> | Transaction<DB>;
type ManageableUser = { isOwner: boolean; roleId: string | null };

export const hasUserChangePermissions = (
  authorization: AuthorizationContext,
  changes: { profile: boolean; role: boolean },
) =>
  (!changes.profile || hasPermission(authorization, 'users.update')) &&
  (!changes.role || hasPermission(authorization, 'users.roles.assign'));

export const canActOnUser = async (
  authorization: AuthorizationContext,
  target: ManageableUser,
  connection: DatabaseConnection = db,
) => {
  if (target.isOwner) return false;
  if (authorization.isOwner) return true;
  if (!target.roleId) return false;

  const targetPermissions = await getRolePermissions(target.roleId, connection);
  return canActOnUserWithPermissions(authorization, target, targetPermissions);
};

export const canActOnUserWithPermissions = (
  authorization: AuthorizationContext,
  target: ManageableUser,
  targetPermissions: Iterable<Permission>,
) => {
  if (target.isOwner) return false;
  if (authorization.isOwner) return true;
  if (!target.roleId) return false;

  return permissionsStrictlyInclude(
    authorization.permissions,
    targetPermissions,
  );
};

export const listDirectoryUsers = async (
  authorization: AuthorizationContext,
  connection: DatabaseConnection = db,
): Promise<DirectoryUser[]> => {
  const [users, grants] = await Promise.all([
    publicUserQuery(connection).execute(),
    connection.selectFrom('accessRolePermission').selectAll().execute(),
  ]);
  const permissionsByRole = new Map<string, Permission[]>();
  for (const grant of grants) {
    if (!isPermission(grant.permission)) continue;
    const permissions = permissionsByRole.get(grant.roleId) ?? [];
    permissions.push(grant.permission);
    permissionsByRole.set(grant.roleId, permissions);
  }

  return users.map((user) => ({
    ...user,
    canManage: canActOnUserWithPermissions(
      authorization,
      user,
      user.roleId ? (permissionsByRole.get(user.roleId) ?? []) : [],
    ),
  }));
};
