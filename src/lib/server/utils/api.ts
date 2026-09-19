import { json } from '@sveltejs/kit';

import {
  authorizationAllowsScope,
  flightScope,
  type ApiScope,
  type FlightScopeAction,
} from '$lib/api/v1/scopes';
import {
  authenticateApiPrincipal,
  principalHasScope,
  type ApiPrincipal,
} from '$lib/server/api/v1/principal';
import { flightOwnership } from '$lib/server/authorization/flight';

export type ApiKeyAuthentication = ApiPrincipal;

/*
 * v0 routes predate scoped credentials, so they used to authenticate through a
 * path that never read `api_key.scopes` at all -- a key restricted to
 * `flight.read.own` on /api/v1 still got unscoped writes here. Delegating to the
 * v1 principal means both API surfaces resolve the same credential, and the
 * routes below gate on `requireScope`.
 */
export const authenticateApiKey = (
  request: Request,
): Promise<ApiKeyAuthentication | null> => authenticateApiPrincipal(request);

export const apiError = (message: string, status = 500) => {
  return json({ success: false, message }, { status });
};

export const unauthorized = () => {
  return apiError('Unauthorized', 401);
};

export const forbidden = () => {
  return apiError('Forbidden', 403);
};

/**
 * Returns an error response when the credential does not carry `scope`, or null
 * when it does. Mirrors `requireApiScope`, in the v0 response shape.
 */
export const requireScope = (
  authentication: ApiKeyAuthentication,
  scope: ApiScope,
) => {
  if (!principalHasScope(authentication, scope)) {
    return apiError(`This credential requires the ${scope} scope`, 403);
  }
  if (!authorizationAllowsScope(authentication.authorization, scope)) {
    return forbidden();
  }
  return null;
};

/**
 * Resolves the caller's ownership for one flight and requires the matching
 * `flight.<action>.<own|any>` scope, in the v0 response shape. The v1 services
 * use the same ownership decision through `requireFlightScope`.
 */
export const requireFlightScope = async (
  authentication: ApiKeyAuthentication,
  action: FlightScopeAction,
  flightId: number,
): Promise<Response | null> => {
  const ownership = await flightOwnership(authentication.user.id, flightId);
  return requireScope(authentication, flightScope(action, ownership));
};
