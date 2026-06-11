import type { PageServerLoad } from './$types';

import { trpcServer } from '$lib/server/server';

export const load: PageServerLoad = async (event) => {
  await trpcServer.flight.list.ssr({ scope: 'mine' }, event);
  await trpcServer.flightTrack.list.ssr({ scope: 'mine' }, event);
};
