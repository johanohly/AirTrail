import { json } from '@sveltejs/kit';
import { z } from 'zod';

import type { RequestHandler } from './$types';

import { apiError, unauthorized, validateApiKey } from '$lib/server/utils/api';
import { deleteFlight, getFlight } from '$lib/server/utils/flight';

const deleteFlightSchema = z.object({
  id: z.number(),
});

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const parsed = deleteFlightSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { success: false, errors: parsed.error.errors },
      { status: 400 },
    );
  }

  const user = await validateApiKey(request);
  if (!user) {
    return unauthorized();
  }

  const flight = await getFlight(parsed.data.id);
  if (!flight) {
    return apiError('Flight not found', 400);
  }

  if (!flight.seats.some((seat) => seat.userId === user.id)) {
    return apiError('You do not have a seat on this flight', 403);
  }

  const result = await deleteFlight(parsed.data.id);

  if (result.numDeletedRows <= 0) {
    return apiError('Failed to delete flight');
  }

  return json({ success: true });
};
