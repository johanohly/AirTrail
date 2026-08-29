import type { Kysely, Transaction } from 'kysely';

import { db } from '$lib/db';
import type { DB } from '$lib/db/schema';
import type { Permission } from '$lib/authorization/permissions';
import { isPermission } from '$lib/authorization/permissions';

type DatabaseConnection = Kysely<DB> | Transaction<DB>;

export type AuthorizationContext = {
  userId: string;
  isOwner: boolean;
  roleId: string | null;
  roleName: string | null;
  roleAssignmentSource: 'local' | 'oauth';
  permissions: ReadonlySet<Permission>;
};

export type ClientAuthorization = Omit<AuthorizationContext, 'permissions'> & {
  permissions: Permission[];
};

const loadContext = async (
  userId: string,
  connection: DatabaseConnection,
  lock: boolean,
): Promise<AuthorizationContext | null> => {
  let userQuery = connection
    .selectFrom('user')
    .select(['id', 'isOwner', 'roleId', 'roleAssignmentSource'])
    .where('id', '=', userId);
  if (lock) userQuery = userQuery.forUpdate();
  const user = await userQuery.executeTakeFirst();
  if (!user) return null;

  let roleName: string | null = null;
  let grants: Array<{ permission: string }> = [];
  if (user.roleId) {
    let roleQuery = connection
      .selectFrom('accessRole')
      .select('name')
      .where('id', '=', user.roleId);
    if (lock) roleQuery = roleQuery.forUpdate();
    const role = await roleQuery.executeTakeFirst();
    if (!role) return null;
    roleName = role.name;
    grants = await connection
      .selectFrom('accessRolePermission')
      .select('permission')
      .where('roleId', '=', user.roleId)
      .execute();
  }

  return {
    userId: user.id,
    isOwner: user.isOwner,
    roleId: user.roleId,
    roleName,
    roleAssignmentSource: user.roleAssignmentSource,
    permissions: new Set(
      grants.map(({ permission }) => permission).filter(isPermission),
    ),
  };
};

export const loadAuthorizationContext = async (userId: string) =>
  loadContext(userId, db, false);

export const loadLockedAuthorizationContext = async (
  userId: string,
  transaction: Transaction<DB>,
) => loadContext(userId, transaction, true);

export const toClientAuthorization = (
  authorization: AuthorizationContext,
): ClientAuthorization => ({
  ...authorization,
  permissions: [...authorization.permissions],
});
