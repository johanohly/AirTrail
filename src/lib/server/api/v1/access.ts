import {
  effectivePermissions,
  hasPermission,
  isPermission,
  PERMISSIONS,
} from '$lib/authorization/permissions';
import type { Permission } from '$lib/authorization/permissions';
import type { ApiScope } from '$lib/api/v1/scopes';
import type { ApiPrincipal } from './principal';
import { principalHasScope } from './principal';
import { ApiOperationError } from './errors';

const scopeFallbackPermissions: Partial<Record<ApiScope, Permission>> = {
  'stats.read': 'flight.read.own',
  'tracks.read': 'flight.read.own',
  'tracks.write': 'flight.update.own',
  'visited_countries.read': 'flight.read.own',
  'visited_countries.write': 'flight.read.own',
  'shares.read': 'flight.share.own',
  'shares.write': 'flight.share.own',
  'weather.read': 'flight.read.own',
};

export const authorizationAllowsScope = (
  principal: Pick<ApiPrincipal, 'authorization'>,
  scope: ApiScope,
) => {
  if (isPermission(scope)) {
    return hasPermission(principal.authorization, scope);
  }
  const permission = scopeFallbackPermissions[scope];
  return permission ? hasPermission(principal.authorization, permission) : true;
};

export const requireApiScope = (principal: ApiPrincipal, scope: ApiScope) => {
  if (!principalHasScope(principal, scope)) {
    throw new ApiOperationError(
      'insufficient_scope',
      `The credential requires ${scope}`,
      403,
    );
  }
  if (!authorizationAllowsScope(principal, scope)) {
    throw new ApiOperationError(
      'forbidden',
      'The current role does not permit this action',
      403,
    );
  }
};

export const effectiveApiPermissions = (
  principal: Pick<ApiPrincipal, 'authorization'>,
) =>
  principal.authorization.isOwner
    ? [...PERMISSIONS]
    : [...effectivePermissions(principal.authorization.permissions)];
