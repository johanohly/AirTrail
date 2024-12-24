import { json } from '@sveltejs/kit';
import { z } from 'zod';

import type { RequestHandler } from './$types';

import { getAirport } from '$lib/server/utils/airport';
import { apiError, unauthorized, validateApiKey } from '$lib/server/utils/api';
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

const saveApiFlightSchema = flightSchema.merge(
  z.object({
    from: z.string(),
    to: z.string(),
  }),
);

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const filled = { ...defaultFlight, ...body };
  const result = saveApiFlightSchema.safeParse(filled);
  if (!result.success) {
    return json(
      { success: false, errors: result.error.errors },
      { status: 400 },
    );
  }

  const user = await validateApiKey(request);
  if (!user) {
    return unauthorized();
  }

  const from = await getAirport(result.data.from);
  if (!from) {
    return apiError('Invalid departure airport');
  }

  const to = await getAirport(result.data.to);
  if (!to) {
    return apiError('Invalid arrival airport');
  }

  const data = {
    ...result.data,
    from,
    to,
  };

  if (data.seats[0]?.userId === '<USER_ID>') {
    data.seats[0].userId = user.id;
  }

  const success = await validateAndCreateFlight(user, data);
  if (!success) {
    return apiError('Failed to save flight');
  }
  return json({ success: true });
};
