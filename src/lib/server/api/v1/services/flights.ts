import { flightScope, flightScopeOwnership } from '$lib/api/v1/scopes';
import {
  resolveFlightScope,
  type FlightScope,
  type FlightScopeParseResult,
} from '$lib/flight-scope';
import { canListFlights } from '$lib/server/authorization/flight';
import { hasPermission } from '$lib/authorization/permissions';
import { listFlightsInScope } from '$lib/server/utils/flight';
import { computeCompletedFlightStatsSummary } from '$lib/stats/summary';
import { toFlightDto } from '$lib/api/v1/dto';
import { canExportFlights } from '$lib/server/authorization/flight';
import { generateBackup } from '$lib/server/utils/backup';
import {
  getFlightTrackSummary,
  listFlightsPage,
  parsePage,
} from '../flight-read';
import { getFlight } from '$lib/server/utils/flight';
import {
  canAccessFlight,
  isFlightParticipant,
} from '$lib/server/authorization/flight';
import { requireApiScope } from '../access';
import { ApiOperationError } from '../errors';
import type { ApiPrincipal } from '../principal';

/*
 * Resolving "which flights may this caller see" is the one decision the flight
 * list, the export and the stats endpoint must agree on. They previously each
 * computed it slightly differently -- the export treated `scope=mine` as own
 * while the other two did not consider it at all.
 */
export const resolveFlightScopeAccess = (
  principal: ApiPrincipal,
  parsed: FlightScopeParseResult,
): FlightScope => {
  if (!parsed.success)
    throw new ApiOperationError(
      'bad_request',
      parsed.reason === 'missing_user'
        ? 'A userId query parameter is required for user scope'
        : 'Invalid scope',
      400,
    );
  const ownership = flightScopeOwnership(parsed.data, principal.user.id);
  requireApiScope(principal, flightScope('read', ownership));
  const permitted =
    ownership === 'own'
      ? hasPermission(principal.authorization, 'flight.read.own')
      : canListFlights(principal.authorization, parsed.data);
  if (!permitted)
    throw new ApiOperationError(
      'forbidden',
      'The current role cannot read this flight scope',
      403,
    );
  return parsed.data;
};

export const getFlightStats = async (
  principal: ApiPrincipal,
  parsed: FlightScopeParseResult,
) => {
  requireApiScope(principal, 'stats.read');
  const scope = resolveFlightScopeAccess(principal, parsed);
  return computeCompletedFlightStatsSummary(
    await listFlightsInScope(resolveFlightScope(scope, principal.user.id)),
  );
};

export const listFlights = async (
  principal: ApiPrincipal,
  parsed: FlightScopeParseResult,
  pagination: { limit: string | null; cursor: string | null },
) => {
  const scope = resolveFlightScopeAccess(principal, parsed);
  const page = parsePage(pagination.limit, pagination.cursor);
  if (!page)
    throw new ApiOperationError('bad_request', 'Invalid pagination', 400);
  const result = await listFlightsPage(
    resolveFlightScope(scope, principal.user.id),
    page,
  );
  if (!result)
    throw new ApiOperationError('bad_request', 'Invalid cursor', 400);
  return {
    data: result.flights.map((flight) =>
      toFlightDto(flight, result.tracks.get(flight.id) ?? null),
    ),
    nextCursor: result.nextCursor,
  };
};

export const exportFlights = async (
  principal: ApiPrincipal,
  parsed: FlightScopeParseResult,
) => {
  if (!parsed.success)
    throw new ApiOperationError('bad_request', 'Invalid scope', 400);
  const ownership = flightScopeOwnership(parsed.data, principal.user.id);
  requireApiScope(principal, flightScope('export', ownership));
  if (!canExportFlights(principal.authorization, parsed.data))
    throw new ApiOperationError(
      'forbidden',
      'The current role cannot export this flight scope',
      403,
    );
  return generateBackup(resolveFlightScope(parsed.data, principal.user.id));
};

export const getFlightById = async (principal: ApiPrincipal, id: number) => {
  const flight = await getFlight(id);
  if (!flight || !(await canAccessFlight(principal.authorization, 'read', id)))
    throw new ApiOperationError('not_found', 'Flight not found', 404);
  const participant = await isFlightParticipant(principal.user.id, id);
  requireApiScope(principal, flightScope('read', participant ? 'own' : 'any'));
  return toFlightDto(flight, await getFlightTrackSummary(id));
};
