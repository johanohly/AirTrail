import { json } from '@sveltejs/kit';

import { requireFlightScope } from '$lib/server/api/v1/access';
import { apiError, legacyApiRoute } from '$lib/server/utils/api';
import { getFlight } from '$lib/server/utils/flight';

export const GET = legacyApiRoute(async ({ principal, event }) => {
  const id = Number(event.params.id);
  if (!Number.isSafeInteger(id)) {
    return apiError('Flight id is not a number', 400);
  }

  const flight = await getFlight(id);
  if (!flight) {
    return apiError('Flight not found', 404);
  }
  await requireFlightScope(principal, 'read', id);
  return json({ success: true, flight });
});
