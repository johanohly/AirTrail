import { json } from '@sveltejs/kit';
import { z } from 'zod';

import type { RequestHandler } from './$types';

import { canAccessFlight } from '$lib/server/authorization/flight';
import {
  apiError,
  authenticateApiKey,
  forbidden,
  unauthorized,
} from '$lib/server/utils/api';
import { deleteFlight, getFlight } from '$lib/server/utils/flight';

const deleteFlightSchema = z.object({
  id: z.number(),
});

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const parsed = deleteFlightSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { success: false, errors: parsed.error.issues },
      { status: 400 },
    );
  }

  const authentication = await authenticateApiKey(request);
  if (!authentication) {
    return unauthorized();
  }
  const { authorization } = authentication;

  const flight = await getFlight(parsed.data.id);
  if (!flight) {
    return apiError('Flight not found', 400);
  }

  if (!(await canAccessFlight(authorization, 'delete', parsed.data.id))) {
    return forbidden();
  }

  const result = await deleteFlight(parsed.data.id);

  if (result.numDeletedRows <= 0) {
    return apiError('Failed to delete flight');
  }

  return json({ success: true });
};
