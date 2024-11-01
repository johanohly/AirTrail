import { z } from 'zod';
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
export type FlightRoute = z.infer<
  typeof flightRouteSchema
>['response']['flightroute'];

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

  return parseResult.data.response.flightroute;
}
