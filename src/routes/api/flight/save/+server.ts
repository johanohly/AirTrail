import { json } from '@sveltejs/kit';
import { z } from 'zod';

import type { RequestHandler } from './$types';

import { getAirportByIcao } from '$lib/server/utils/airport';
import { apiError, unauthorized, validateApiKey } from '$lib/server/utils/api';
import { validateAndSaveFlight } from '$lib/server/utils/flight';
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

const defaultSeat = {
  guestName: null,
  seat: null,
  seatNumber: null,
  seatClass: null,
};

const saveApiFlightSchema = flightSchema.merge(
  z.object({
    from: z.string(),
    to: z.string(),
  }),
);

const dateTimeSchema = z.string().datetime({ offset: true });

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const filled = {
    ...defaultFlight,
    ...body,
    seats: body.seats.map((s) => ({ ...defaultSeat, ...s })),
  };
  const flight = {
    ...filled,
    departure: dateTimeSchema.safeParse(filled.departure).success
      ? filled.departure
      : filled.departure
        ? filled.departure + 'T10:00:00.000+00:00'
        : null,
    arrival: dateTimeSchema.safeParse(filled.arrival).success
      ? filled.arrival
      : filled.arrival
        ? filled.arrival + 'T10:00:00.000+00:00'
        : null,
  };

  const parsed = saveApiFlightSchema.safeParse(flight);
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

  const from = await getAirportByIcao(parsed.data.from);
  if (!from) {
    return apiError('Invalid departure airport');
  }

  const to = await getAirportByIcao(parsed.data.to);
  if (!to) {
    return apiError('Invalid arrival airport');
  }

  const data = {
    ...parsed.data,
    from,
    to,
  };

  if (data.seats[0]?.userId === '<USER_ID>') {
    data.seats[0].userId = user.id;
  }

  const result = await validateAndSaveFlight(user, data);
  if (!result.success) {
    // @ts-expect-error - this should be valid
    return apiError(result.message, result.status || 500);
  }

  return json({ success: true, ...(result.id && { id: result.id }) });
};
