import {
  effectivePermissions,
  PERMISSIONS,
} from '$lib/authorization/permissions';
import {
  authorizationAllowsScope as scopeAllowedBy,
  type ApiScope,
} from '$lib/api/v1/scopes';
import type { ApiPrincipal } from './principal';
import { principalHasScope } from './principal';
import { ApiOperationError } from './errors';

export const authorizationAllowsScope = (
  principal: Pick<ApiPrincipal, 'authorization'>,
  scope: ApiScope,
) => scopeAllowedBy(principal.authorization, scope);

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
