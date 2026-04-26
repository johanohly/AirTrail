import { z } from 'zod';

import { authedProcedure, router } from '$lib/server/trpc';
import { getParsedMetar } from '$lib/server/utils/metar';

export const weatherRouter = router({
  getMetar: authedProcedure
    .input(z.string().regex(/^[A-Za-z][A-Za-z0-9]{3}$/))
    .query(async ({ input }) => {
      return await getParsedMetar(input);
    }),
});
