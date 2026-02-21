import { json } from '@sveltejs/kit';
import { z } from 'zod';

import type { RequestHandler } from './$types';

import { getAircraftByIcao } from '$lib/server/utils/aircraft';
import { getAirlineByIcao } from '$lib/server/utils/airline';
import { getAirportByIata, getAirportByIcao } from '$lib/server/utils/airport';
import { apiError, unauthorized, validateApiKey } from '$lib/server/utils/api';
import { validateAndSaveFlight } from '$lib/server/utils/flight';
import { aircraftSchema } from '$lib/zod/aircraft';
import { airlineSchema } from '$lib/zod/airline';
import { flightSchema } from '$lib/zod/flight';

const defaultFlight = {
  // from, to and departure are required
  arrival: null,
  arrivalScheduled: null,
  departureTime: null,
  arrivalTime: null,
  departureScheduled: null,
  departureScheduledTime: null,
  arrivalScheduledTime: null,
  takeoffScheduled: null,
  takeoffScheduledTime: null,
  takeoffActual: null,
  takeoffActualTime: null,
  landingScheduled: null,
  landingScheduledTime: null,
  landingActual: null,
  landingActualTime: null,
  airline: null,
  flightNumber: null,
  aircraft: null,
  aircraftReg: null,
  flightReason: null,
  note: null,
  customFields: {},
};

const defaultSeat = {
  guestName: null,
  seat: null,
  seatNumber: null,
  seatClass: null,
};

const saveApiFlightSchema = flightSchema
  .merge(
    z.object({
      from: z.string(),
      to: z.string(),
    }),
  )
  .merge(
    z.object({
      aircraft: aircraftSchema.shape.icao,
    }),
  )
  .merge(
    z.object({
      airline: airlineSchema.shape.icao,
    }),
  );

const dateTimeSchema = z.string().datetime({ offset: true });

const getAirportByCode = async (input: string) => {
  return (await getAirportByIcao(input)) ?? (await getAirportByIata(input));
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const filled = {
    ...defaultFlight,
    ...body,
    seats: Array.isArray(body.seats)
      ? body.seats.map((s: unknown) => ({
          ...defaultSeat,
          ...(s && typeof s === 'object' ? s : {}),
        }))
      : [],
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

  const from = await getAirportByCode(parsed.data.from);
  if (!from) {
    return apiError('Invalid departure airport');
  }

  const to = await getAirportByCode(parsed.data.to);
  if (!to) {
    return apiError('Invalid arrival airport');
  }

  let aircraft;
  if (parsed.data.aircraft) {
    aircraft = await getAircraftByIcao(parsed.data.aircraft);
    if (!aircraft) {
      return apiError('Invalid aircraft');
    }
  }

  let airline;
  if (parsed.data.airline) {
    airline = await getAirlineByIcao(parsed.data.airline);
    if (!airline) {
      return apiError('Invalid airline');
    }
  }

  const data = {
    ...parsed.data,
    from,
    to,
    aircraft,
    airline,
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
