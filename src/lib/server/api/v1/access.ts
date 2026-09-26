import {
  effectivePermissions,
  PERMISSIONS,
} from '$lib/authorization/permissions';
import { API_OPERATIONS, type ApiOperationId } from '$lib/api/v1/operations';
import {
  authorizationAllowsScope,
  flightScope,
  type ApiScope,
  type FlightScopeOwnership,
} from '$lib/api/v1/scopes';
import type { DatabaseConnection } from '$lib/db/types';
import {
  canAccessResolvedOwnership,
  flightOwnership,
} from '$lib/server/authorization/flight';
import type { FlightWriter } from '$lib/server/utils/flight';
import { ApiOperationError } from './errors';
import { principalHasScope, type ApiPrincipal } from './principal';

export const requireApiScope = (principal: ApiPrincipal, scope: ApiScope) => {
  if (!principalHasScope(principal, scope)) {
    throw new ApiOperationError(
      'insufficient_scope',
      `The credential requires ${scope}`,
    );
  }
  if (!authorizationAllowsScope(principal.authorization, scope)) {
    throw new ApiOperationError(
      'forbidden',
      'The current role does not permit this action',
    );
  }
};

/** The scopes every call to `operation` needs, from the operation registry. */
export const requireOperation = (
  principal: ApiPrincipal,
  operation: ApiOperationId,
) => {
  for (const scope of API_OPERATIONS[operation].requires)
    requireApiScope(principal, scope);
};

/*
 * "May this credential act on this flight": resolve ownership from
 * participation once, then apply the role check and the matching
 * `flight.<action>.<own|any>` scope. A role denial is masked as `not_found`.
 */
export const requireFlightScope = async (
  principal: ApiPrincipal,
  action: 'read' | 'update' | 'delete',
  flightId: number,
  connection?: DatabaseConnection,
): Promise<FlightScopeOwnership> => {
  const ownership = await flightOwnership(
    principal.user.id,
    flightId,
    connection,
  );
  if (!canAccessResolvedOwnership(principal.authorization, action, ownership)) {
    throw new ApiOperationError('not_found', 'Flight not found');
  }
  requireApiScope(principal, flightScope(action, ownership));
  return ownership;
};

export const apiFlightWriter = (principal: ApiPrincipal): FlightWriter => ({
  authorization: principal.authorization,
  requireScope: (scope) => requireApiScope(principal, scope),
});

export const effectiveApiPermissions = (
  principal: Pick<ApiPrincipal, 'authorization'>,
) =>
  principal.authorization.isOwner
    ? [...PERMISSIONS]
    : [...effectivePermissions(principal.authorization.permissions)];
