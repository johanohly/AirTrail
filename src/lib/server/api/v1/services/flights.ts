import { flightScope, flightScopeOwnership } from '$lib/api/v1/scopes';
import { resolveFlightScope, type FlightScope } from '$lib/flight-scope';
import { hasPermission } from '$lib/authorization/permissions';
import { listFlightsInScope } from '$lib/server/utils/flight';
import { computeCompletedFlightStatsSummary } from '$lib/stats/summary';
import { toFlightDto } from '$lib/api/v1/dto';
import { generateBackup } from '$lib/server/utils/backup';
import {
  getFlightTrackSummary,
  listFlightsPage,
  type FlightPage,
} from '../flight-read';
import { getFlight } from '$lib/server/utils/flight';
import { requireApiScope, requireFlightScope } from '../access';
import { ApiOperationError } from '../errors';
import type { ApiPrincipal } from '../principal';

/*
 * Resolving "which flights may this caller see" is the one decision the flight
 * list, the export and the stats endpoint must agree on. They previously each
 * computed it slightly differently -- the export treated `scope=mine` as own
 * while the other two did not consider it at all.
 *
 * `action` selects the credential scope (`flight.read.*` / `flight.export.*`);
 * `permitted` is the matching role check for the resolved ownership. The
 * ownership decision therefore lives here once; the query-string parse and its
 * error live at the transport boundary in `query.ts`.
 */
export const resolveFlightScopeAccess = (
  principal: ApiPrincipal,
  scope: FlightScope,
  {
    action,
    permitted,
  }: {
    action: 'read' | 'export';
    permitted: (ownership: 'own' | 'any') => boolean;
  },
): FlightScope => {
  const ownership = flightScopeOwnership(scope, principal.user.id);
  requireApiScope(principal, flightScope(action, ownership));
  if (!permitted(ownership))
    throw new ApiOperationError(
      'forbidden',
      `The current role cannot ${action} this flight scope`,
    );
  return scope;
};

const readScopeAccess = (principal: ApiPrincipal) => ({
  action: 'read' as const,
  permitted: (ownership: 'own' | 'any') =>
    hasPermission(principal.authorization, `flight.read.${ownership}`),
});

export const getFlightStats = async (
  principal: ApiPrincipal,
  scope: FlightScope,
) => {
  requireApiScope(principal, 'stats.read');
  const resolved = resolveFlightScopeAccess(
    principal,
    scope,
    readScopeAccess(principal),
  );
  return computeCompletedFlightStatsSummary(
    await listFlightsInScope(resolveFlightScope(resolved, principal.user.id)),
  );
};

export const listFlights = async (
  principal: ApiPrincipal,
  scope: FlightScope,
  page: FlightPage,
) => {
  const resolved = resolveFlightScopeAccess(
    principal,
    scope,
    readScopeAccess(principal),
  );
  const result = await listFlightsPage(
    resolveFlightScope(resolved, principal.user.id),
    page,
  );
  return {
    data: result.flights.map((flight) =>
      toFlightDto(flight, result.tracks.get(flight.id) ?? null),
    ),
    nextCursor: result.nextCursor,
  };
};

export const exportFlights = async (
  principal: ApiPrincipal,
  scope: FlightScope,
) => {
  const resolved = resolveFlightScopeAccess(principal, scope, {
    action: 'export',
    permitted: (ownership) =>
      hasPermission(principal.authorization, `flight.export.${ownership}`),
  });
  return generateBackup(resolveFlightScope(resolved, principal.user.id));
};

/** The DTO without a scope check, for reads already authorized by a write. */
export const readFlightDto = async (id: number) => {
  const flight = await getFlight(id);
  if (!flight) throw new ApiOperationError('not_found', 'Flight not found');
  return toFlightDto(flight, await getFlightTrackSummary(id));
};

export const getFlightById = async (principal: ApiPrincipal, id: number) => {
  const flight = await getFlight(id);
  if (!flight) throw new ApiOperationError('not_found', 'Flight not found');
  await requireFlightScope(principal, 'read', id);
  return toFlightDto(flight, await getFlightTrackSummary(id));
};
