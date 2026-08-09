import { db } from '$lib/db';
import type { Permission } from '$lib/authorization/permissions';
import { isPermission } from '$lib/authorization/permissions';

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

export const loadAuthorizationContext = async (
  userId: string,
): Promise<AuthorizationContext | null> => {
  const user = await db
    .selectFrom('user')
    .leftJoin('accessRole', 'accessRole.id', 'user.roleId')
    .select([
      'user.id',
      'user.isOwner',
      'user.roleId',
      'user.roleAssignmentSource',
      'accessRole.name as roleName',
    ])
    .where('user.id', '=', userId)
    .executeTakeFirst();

  if (!user) return null;

  const grants = user.roleId
    ? await db
        .selectFrom('accessRolePermission')
        .select('permission')
        .where('roleId', '=', user.roleId)
        .execute()
    : [];

  return {
    userId: user.id,
    isOwner: user.isOwner,
    roleId: user.roleId,
    roleName: user.roleName,
    roleAssignmentSource: user.roleAssignmentSource,
    permissions: new Set(
      grants.map(({ permission }) => permission).filter(isPermission),
    ),
  };
};

export const toClientAuthorization = (
  authorization: AuthorizationContext,
): ClientAuthorization => ({
  ...authorization,
  permissions: [...authorization.permissions],
});
