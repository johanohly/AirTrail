import { z } from 'zod';

import { getAirlineByIcao } from '$lib/server/utils/airline';
import { getAirportByIcao } from '$lib/server/utils/airport';
import { RequestRateLimiter } from '$lib/utils/ratelimiter';

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
  const from = await getAirportByIcao(result.origin.icao_code);
  const to = await getAirportByIcao(result.destination.icao_code);
  if (!from || !to) {
    throw new Error('Flight not found');
  }

  const airline = await getAirlineByIcao(result.airline.icao);

  return [
    {
      from,
      to,
      airline,
      departure: null,
      arrival: null,
    },
  ];
}
