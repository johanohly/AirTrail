import { PERMISSIONS } from '$lib/authorization/permissions';
import { db } from '$lib/db';
import { hasPermission } from './authorize';
import type { AuthorizationContext } from './context';
import { getRolePermissions } from './roles';

const effectivePermissions = (permissions: string[]) =>
  new Set(
    PERMISSIONS.filter((permission) => {
      if (permissions.includes(permission)) return true;
      if (!permission.endsWith('.own')) return false;
      return permissions.includes(`${permission.slice(0, -4)}.any`);
    }),
  );

export const canManageUser = async (
  authorization: AuthorizationContext,
  targetUserId: string,
  permission: 'users.update' | 'users.delete',
) => {
  if (!hasPermission(authorization, permission)) return false;
  const target = await db
    .selectFrom('user')
    .select(['id', 'isOwner', 'roleId'])
    .where('id', '=', targetUserId)
    .executeTakeFirst();
  if (!target || target.isOwner) return false;
  if (authorization.isOwner) return true;
  if (!target.roleId) return false;

  const targetSet = effectivePermissions(
    await getRolePermissions(target.roleId),
  );
  const actorSet = effectivePermissions([...authorization.permissions]);
  const subset = [...targetSet].every((permission) => actorSet.has(permission));
  return subset && actorSet.size > targetSet.size;
};
