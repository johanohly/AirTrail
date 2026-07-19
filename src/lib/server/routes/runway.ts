import { z } from 'zod';

import { authedProcedure, router } from '$lib/server/trpc';
import { getRunwaysByAirport } from '$lib/server/utils/runway';

export const runwayRouter = router({
  getByAirport: authedProcedure.input(z.number()).query(async ({ input }) => {
    return await getRunwaysByAirport(input);
  }),
});
