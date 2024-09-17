import type { PageServerLoad } from './$types';
import { trpcServer } from '$lib/server/server';
import { db } from '$lib/db';

export const load: PageServerLoad = async (event) => {
  await trpcServer.flight.list.ssr(event);

  return {
    users: (await db.selectFrom('user').selectAll().execute()).map(
      ({ password, ...rest }) => rest,
    ),
  };
};
