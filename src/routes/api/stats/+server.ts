import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

import {
  parseFlightScopeSearchParams,
  resolveFlightScope,
} from '$lib/flight-scope';
import { canListFlights } from '$lib/server/authorization/flight';
import {
  apiError,
  authenticateApiKey,
  forbidden,
  unauthorized,
} from '$lib/server/utils/api';
import { listFlightsInScope } from '$lib/server/utils/flight';
import { computeCompletedFlightStatsSummary } from '$lib/stats/summary';

export const GET: RequestHandler = async ({ request, url }) => {
  const authentication = await authenticateApiKey(request);
  if (!authentication) {
    return unauthorized();
  }
  const { user, authorization } = authentication;

  const parsedScope = parseFlightScopeSearchParams(url.searchParams);
  if (!parsedScope.success) {
    return apiError(
      parsedScope.reason === 'missing_user'
        ? 'A userId query parameter is required for user scope'
        : 'Invalid scope',
      400,
    );
  }
  if (!canListFlights(authorization, parsedScope.data)) return forbidden();

  const flights = await listFlightsInScope(
    resolveFlightScope(parsedScope.data, user.id),
  );
  return json({
    success: true,
    stats: computeCompletedFlightStatsSummary(flights),
  });
};
