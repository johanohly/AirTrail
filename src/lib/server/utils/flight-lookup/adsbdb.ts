import { z } from 'zod';

import { RequestRateLimiter } from '$lib/utils/ratelimiter';
import { getAirport } from '$lib/server/utils/airport';
import { airlineFromICAO } from '$lib/utils/data/airlines';

const flightRouteSchema = z.object({
  response: z.object({
    flightroute: z.object({
      origin: z.object({ icao_code: z.string() }),
      destination: z.object({ icao_code: z.string() }),
      airline: z.object({ icao: z.string() }),
    }),
  }),
});

const ratelimiter = new RequestRateLimiter();

export async function getFlightRoute(flightNumber: string) {
  await ratelimiter.checkRequest();

  const resp = await fetch(
    `https://api.adsbdb.com/v0/callsign/${flightNumber}`,
  );
  if (!resp.ok) {
    throw new Error('Flight not found');
  }

  const data = await resp.json();
  const parseResult = flightRouteSchema.safeParse(data);
  if (!parseResult.success) {
    throw new Error('Flight not found');
  }

  const result = parseResult.data.response.flightroute;
  const from = await getAirport(result.origin.icao_code);
  const to = await getAirport(result.destination.icao_code);
  if (!from || !to) {
    throw new Error('Flight not found');
  }

  return [
    {
      from,
      to,
      airline: airlineFromICAO(result.airline.icao),
      departure: null,
      arrival: null,
    },
  ];
}
