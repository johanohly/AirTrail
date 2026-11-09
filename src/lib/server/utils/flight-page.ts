import type { RequestEvent } from '@sveltejs/kit';

import { DEFAULT_FLIGHT_SCOPE } from '$lib/flight-scope';
import { canListFlights } from '$lib/server/authorization/flight';
import { trpcServer } from '$lib/server/server';

/**
 * Prefetches the flight list and flight tracks for the map page and its
 * `/flights` and `/statistics` aliases, so the initial render has data ready.
 */
export const prefetchFlightPageData = async (
  event: Pick<RequestEvent, 'locals'>,
): Promise<void> => {
  if (
    !event.locals.authorization ||
    !canListFlights(event.locals.authorization, DEFAULT_FLIGHT_SCOPE)
  ) {
    return;
  }
  await trpcServer.flight.list.ssr({ scope: 'mine' });
  await trpcServer.flightTrack.list.ssr({ scope: 'mine' });
};
