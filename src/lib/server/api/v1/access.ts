import type { Kysely } from 'kysely';

import {
  effectivePermissions,
  PERMISSIONS,
} from '$lib/authorization/permissions';
import {
  authorizationAllowsScope,
  flightScope,
  type ApiScope,
  type FlightScopeOwnership,
} from '$lib/api/v1/scopes';
import type { DB } from '$lib/db/schema';
import {
  canAccessResolvedOwnership,
  flightOwnership,
  type FlightAccessAction,
} from '$lib/server/authorization/flight';
import type { ApiPrincipal } from './principal';
import { principalHasScope } from './principal';
import { ApiOperationError } from './errors';

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

/*
 * The single decision for "may this credential act on this flight": resolve the
 * caller's ownership from participation once, then apply both the role check
 * (`canAccessResolvedOwnership`) and the credential scope check
 * (`flight.<action>.<own|any>`). Callers that previously called
 * `canAccessFlight` and then `flightOwnership` paid for two identical
 * `flight_participant` reads and held two copies of the ownership rule.
 *
 * The role denial stays masked as `not_found`; the scope denial is a distinct
 * 403, matching the surfaces this replaced.
 */
export const requireFlightScope = async (
  principal: ApiPrincipal,
  action: Exclude<FlightAccessAction, 'passengers.manage'>,
  flightId: number,
  connection?: Kysely<DB>,
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

export const effectiveApiPermissions = (
  principal: Pick<ApiPrincipal, 'authorization'>,
) =>
  principal.authorization.isOwner
    ? [...PERMISSIONS]
    : [...effectivePermissions(principal.authorization.permissions)];
