import type { PageServerLoad } from './$types';
import { trpcServer } from '$lib/server/server';

export const load: PageServerLoad = async (event) => {
  await trpcServer.flight.list.ssr(event);

  return {
    user: event.locals.user,
  };
};
