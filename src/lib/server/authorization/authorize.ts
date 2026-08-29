import {
  hasPermission,
  isPermission,
  type Permission,
} from '$lib/authorization/permissions';
import type { DB } from '$lib/db/schema';
import type { Transaction } from 'kysely';
import {
  loadLockedAuthorizationContext,
  type AuthorizationContext,
} from './context';

export { hasPermission };

export class AuthorizationError extends Error {
  constructor(
    message = 'Forbidden',
    public readonly status = 403,
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export const requirePermission = (
  authorization: AuthorizationContext | null,
  permission: Permission,
) => {
  if (!authorization) {
    throw new AuthorizationError('Unauthorized', 401);
  }
  if (!hasPermission(authorization, permission)) {
    throw new AuthorizationError();
  }
  return authorization;
};

export const permissionsAreSubset = (
  permissions: Iterable<string>,
  authorization: AuthorizationContext,
) =>
  authorization.isOwner ||
  [...permissions].every(
    (permission) =>
      isPermission(permission) && hasPermission(authorization, permission),
  );

export const requireLockedPermissions = async ({
  userId,
  permissions,
  transaction,
}: {
  userId: string;
  permissions: readonly [Permission, ...Permission[]];
  transaction: Transaction<DB>;
}) => {
  const authorization = await loadLockedAuthorizationContext(
    userId,
    transaction,
  );
  const [firstPermission, ...remainingPermissions] = permissions;
  const requiredAuthorization = requirePermission(
    authorization,
    firstPermission,
  );
  for (const permission of remainingPermissions) {
    requirePermission(requiredAuthorization, permission);
  }
  return requiredAuthorization;
};
