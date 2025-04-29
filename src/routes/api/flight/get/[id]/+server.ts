import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

import { apiError, unauthorized, validateApiKey } from '$lib/server/utils/api';
import { getFlight } from '$lib/server/utils/flight';

export const GET: RequestHandler = async ({ request, params }) => {
  const user = await validateApiKey(request);
  if (!user) {
    return unauthorized();
  }

  const id = +params.id;
  if (isNaN(id)) {
    return apiError('Flight id is not a number', 400);
  }

  const flight = await getFlight(id);
  if (!flight?.seats.some((seat) => seat.userId === user.id)) {
    return apiError(
      'Flight not found or you do not have a seat on this flight',
      403,
    );
  }

  return json({ success: true, flight });
};
