import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

import { apiError, unauthorized, validateApiKey } from '$lib/server/utils/api';
import { listAllFlights, listFlights } from '$lib/server/utils/flight';

export const GET: RequestHandler = async ({ request, url }) => {
  const user = await validateApiKey(request);
  if (!user) {
    return unauthorized();
  }

  const scope = url.searchParams.get('scope') ?? 'mine';

  if (scope === 'mine') {
    const flights = await listFlights(user.id);
    return json({ success: true, flights });
  }

  if (user.role === 'user') {
    return apiError('Forbidden', 403);
  }

  if (scope === 'user') {
    const userId = url.searchParams.get('userId');
    if (!userId) {
      return apiError(
        'A userId query parameter is required for user scope',
        400,
      );
    }

    const flights = await listFlights(userId);
    return json({ success: true, flights });
  }

  if (scope === 'all') {
    const flights = await listAllFlights();
    return json({ success: true, flights });
  }

  return apiError('Invalid scope', 400);
};
