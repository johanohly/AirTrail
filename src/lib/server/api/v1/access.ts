import type { Kysely } from 'kysely';

import {
  effectivePermissions,
  PERMISSIONS,
} from '$lib/authorization/permissions';
import {
  authorizationAllowsScope,
  flightScope,
  type ApiScope,
  type FlightScopeAction,
} from '$lib/api/v1/scopes';
import type { DB } from '$lib/db/schema';
import { flightOwnership } from '$lib/server/authorization/flight';
import type { ApiPrincipal } from './principal';
import { principalHasScope } from './principal';
import { ApiOperationError } from './errors';

export const requireApiScope = (principal: ApiPrincipal, scope: ApiScope) => {
  if (!principalHasScope(principal, scope)) {
    throw new ApiOperationError(
      'insufficient_scope',
      `The credential requires ${scope}`,
      403,
    );
  }
  if (!authorizationAllowsScope(principal.authorization, scope)) {
    throw new ApiOperationError(
      'forbidden',
      'The current role does not permit this action',
      403,
    );
  }
};

/*
 * The single decision for "may this credential act on this flight": resolve the
 * caller's ownership from participation, then require
 * `flight.<action>.<own|any>`. Every flight-scoped service previously re-derived
 * this, which is how one of them shipped checking only the role half.
 */
export const requireFlightScope = async (
  principal: ApiPrincipal,
  action: FlightScopeAction,
  flightId: number,
  connection?: Kysely<DB>,
) => {
  const ownership = await flightOwnership(
    principal.user.id,
    flightId,
    connection,
  );
  requireApiScope(principal, flightScope(action, ownership));
};

export const effectiveApiPermissions = (
  principal: Pick<ApiPrincipal, 'authorization'>,
) =>
  principal.authorization.isOwner
    ? [...PERMISSIONS]
    : [...effectivePermissions(principal.authorization.permissions)];
