import type { PageServerLoad } from './$types';

import { DEFAULT_FLIGHT_SCOPE } from '$lib/flight-scope';
import { trpcServer } from '$lib/server/server';
import { canListFlights } from '$lib/server/authorization/flight';

export const load: PageServerLoad = async (event) => {
  if (
    !event.locals.authorization ||
    !canListFlights(event.locals.authorization, DEFAULT_FLIGHT_SCOPE)
  ) {
    return;
  }
  await trpcServer.flight.list.ssr({ scope: 'mine' }, event);
  await trpcServer.flightTrack.list.ssr({ scope: 'mine' }, event);
};
