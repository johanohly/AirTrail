import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

import { canAccessFlight } from '$lib/server/authorization/flight';
import {
  apiError,
  authenticateApiKey,
  unauthorized,
} from '$lib/server/utils/api';
import { getFlight } from '$lib/server/utils/flight';

export const GET: RequestHandler = async ({ request, params }) => {
  const authentication = await authenticateApiKey(request);
  if (!authentication) {
    return unauthorized();
  }
  const { authorization } = authentication;

  const id = +params.id;
  if (isNaN(id)) {
    return apiError('Flight id is not a number', 400);
  }

  const flight = await getFlight(id);
  if (!flight) {
    return apiError('Flight not found', 404);
  }
  if (!(await canAccessFlight(authorization, 'read', id))) {
    return apiError('Flight not found', 404);
  }

  return json({ success: true, flight });
};
