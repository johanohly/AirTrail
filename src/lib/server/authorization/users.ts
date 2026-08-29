import type { Kysely, Transaction } from 'kysely';

import {
  permissionsStrictlyInclude,
  type Permission,
} from '$lib/authorization/permissions';
import { db } from '$lib/db';
import type { DB } from '$lib/db/schema';
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

  return permissionsStrictlyInclude(
    authorization.permissions,
    await getRolePermissions(target.roleId, connection),
  );
};
