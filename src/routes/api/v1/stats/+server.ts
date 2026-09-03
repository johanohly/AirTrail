import type { RequestHandler } from './$types';
import {
  parseFlightScopeSearchParams,
  resolveFlightScope,
} from '$lib/flight-scope';
import { listFlightsInScope } from '$lib/server/utils/flight';
import { computeCompletedFlightStatsSummary } from '$lib/stats/summary';
import { canListFlights } from '$lib/server/authorization/flight';
import { hasPermission } from '$lib/authorization/permissions';
import { authenticateRestPrincipal } from '$lib/server/api/v1/authenticate';
import { apiV1Error, apiV1Unauthorized } from '$lib/server/api/v1/errors';
import { requireApiScope } from '$lib/server/api/v1/access';
import { principalHasScope } from '$lib/server/api/v1/principal';
import { apiV1Data, handleApiV1Error } from '$lib/server/api/v1/response';
export const GET: RequestHandler = async (event) => {
  const principal = await authenticateRestPrincipal(event);
  if (!principal) return apiV1Unauthorized('stats.read');
  try {
    requireApiScope(principal, 'stats.read');
    const parsed = parseFlightScopeSearchParams(event.url.searchParams);
    const canReadScope =
      parsed.success &&
      parsed.data.scope === 'user' &&
      parsed.data.userId === principal.user.id
        ? hasPermission(principal.authorization, 'flight.read.own')
        : parsed.success &&
          canListFlights(principal.authorization, parsed.data);
    if (!parsed.success || !canReadScope)
      return apiV1Error('forbidden', 'Cannot read this scope', 403);
    const required =
      parsed.data.scope === 'all' ||
      (parsed.data.scope === 'user' && parsed.data.userId !== principal.user.id)
        ? 'flight.read.any'
        : 'flight.read.own';
    if (!principalHasScope(principal, required))
      return apiV1Error(
        'insufficient_scope',
        `The credential requires ${required}`,
        403,
      );
    return apiV1Data(
      computeCompletedFlightStatsSummary(
        await listFlightsInScope(
          resolveFlightScope(parsed.data, principal.user.id),
        ),
      ),
    );
  } catch (error) {
    return handleApiV1Error(error);
  }
};
