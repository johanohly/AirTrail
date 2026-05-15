import { z } from 'zod';

import { db } from '$lib/db';
import { authedProcedure, router } from '$lib/server/trpc';
import { getParsedMetar } from '$lib/server/utils/metar';

export const weatherRouter = router({
  getMetar: authedProcedure
    .input(z.string().regex(/^[A-Za-z][A-Za-z0-9]{3}$/))
    .query(async ({ input }) => {
      // Restrict to ICAOs referenced by an actual flight to limit outbound
      // fetches and prevent enumeration of arbitrary station codes.
      const referenced = await db
        .selectFrom('airport')
        .select('airport.id')
        .where('airport.icao', 'ilike', input)
        .where((eb) =>
          eb.or([
            eb.exists(
              eb
                .selectFrom('flight')
                .select('flight.id')
                .whereRef('flight.fromId', '=', 'airport.id'),
            ),
            eb.exists(
              eb
                .selectFrom('flight')
                .select('flight.id')
                .whereRef('flight.toId', '=', 'airport.id'),
            ),
          ]),
        )
        .limit(1)
        .executeTakeFirst();
      if (!referenced) return null;
      return await getParsedMetar(input);
    }),
});
