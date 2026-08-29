import {
  hasPermission,
  isPermission,
  type Permission,
} from '$lib/authorization/permissions';
import type { AuthorizationContext } from './context';

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
