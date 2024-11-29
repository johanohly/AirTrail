import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

import { validateApiKey } from '$lib/server/utils/auth';
import { validateAndCreateFlight } from '$lib/server/utils/flight';
import { flightSchema } from '$lib/zod/flight';

const defaultFlight = {
  // from, to and departure are required
  arrival: null,
  departureTime: null,
  arrivalTime: null,
  airline: null,
  flightNumber: null,
  aircraft: null,
  aircraftReg: null,
  flightReason: null,
  note: null,
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const filled = { ...defaultFlight, ...body };
  const result = flightSchema.safeParse(filled);
  if (!result.success) {
    return json(
      { success: false, errors: result.error.errors },
      { status: 400 },
    );
  }

  const user = await validateApiKey(request);
  if (!user) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const data = result.data;

  if (data.seats[0]?.userId === '<USER_ID>') {
    data.seats[0].userId = user.id;
  }

  const success = await validateAndCreateFlight(user, data);
  if (!success) {
    return json(
      { success: false, message: 'Failed to save flight' },
      { status: 500 },
    );
  }
  return json({ success: true });
};
