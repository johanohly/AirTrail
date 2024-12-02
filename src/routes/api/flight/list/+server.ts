import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

import { unauthorized, validateApiKey } from '$lib/server/utils/api';
import { listFlights } from '$lib/server/utils/flight';

export const GET: RequestHandler = async ({ request }) => {
  const user = await validateApiKey(request);
  if (!user) {
    return unauthorized();
  }

  const flights = await listFlights(user.id);
  return json({ success: true, flights });
};
