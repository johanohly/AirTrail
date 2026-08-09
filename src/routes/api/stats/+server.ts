import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

import { hasPermission } from '$lib/server/authorization/authorize';
import {
  apiError,
  authenticateApiKey,
  forbidden,
  unauthorized,
} from '$lib/server/utils/api';
import { listAllFlights, listFlights } from '$lib/server/utils/flight';
import { computeCompletedFlightStatsSummary } from '$lib/stats/summary';

export const GET: RequestHandler = async ({ request, url }) => {
  const authentication = await authenticateApiKey(request);
  if (!authentication) {
    return unauthorized();
  }
  const { user, authorization } = authentication;

  const scope = url.searchParams.get('scope') ?? 'mine';

  if (scope === 'mine') {
    if (!hasPermission(authorization, 'flight.read.own')) return forbidden();
    const flights = await listFlights(user.id);
    return json({
      success: true,
      stats: computeCompletedFlightStatsSummary(flights),
    });
  }

  if (!hasPermission(authorization, 'flight.read.any')) return forbidden();

  if (scope === 'user') {
    const userId = url.searchParams.get('userId');
    if (!userId) {
      return apiError(
        'A userId query parameter is required for user scope',
        400,
      );
    }

    const flights = await listFlights(userId);
    return json({
      success: true,
      stats: computeCompletedFlightStatsSummary(flights),
    });
  }

  if (scope === 'all') {
    const flights = await listAllFlights();
    return json({
      success: true,
      stats: computeCompletedFlightStatsSummary(flights),
    });
  }

  return apiError('Invalid scope', 400);
};
