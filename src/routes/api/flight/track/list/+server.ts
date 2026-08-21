import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

import { apiError, unauthorized, validateApiKey } from '$lib/server/utils/api';
import {
  listAllFlightTracks,
  listFlightTracks,
} from '$lib/server/utils/flight-track';

export const GET: RequestHandler = async ({ request, url }) => {
  const user = await validateApiKey(request);
  if (!user) {
    return unauthorized();
  }

  const scope = url.searchParams.get('scope') ?? 'mine';

  if (scope === 'mine') {
    const tracks = await listFlightTracks(user.id, { reduceForMap: true });
    return json({ success: true, tracks });
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

    const tracks = await listFlightTracks(userId, { reduceForMap: true });
    return json({ success: true, tracks });
  }

  if (scope === 'all') {
    const tracks = await listAllFlightTracks({ reduceForMap: true });
    return json({ success: true, tracks });
  }

  return apiError('Invalid scope', 400);
};
