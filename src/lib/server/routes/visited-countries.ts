import { z } from 'zod';

import { authedProcedure, router } from '../trpc';

import { db } from '$lib/db';
import { VisitedCountryStatus } from '$lib/db/types';
import { listFlights } from '$lib/server/utils/flight';
import { countryFromAlpha } from '$lib/utils/data/countries';

const VisitedCountrySchema = z.object({
  code: z.number(),
  status: z.enum(VisitedCountryStatus).nullable(),
  note: z.string().nullable(),
});

export const visitedCountriesRouter = router({
  list: authedProcedure.query(async ({ ctx }) => {
    return await db
      .selectFrom('visitedCountry')
      .select(['note', 'code', 'status'])
      .where('userId', '=', ctx.user.id)
      .execute();
  }),
  save: authedProcedure
    .input(VisitedCountrySchema)
    .mutation(async ({ ctx, input }) => {
      const status = input.status;
      if (status) {
        const result = await db
          .insertInto('visitedCountry')
          .values({
            userId: ctx.user.id,
            code: input.code,
            status,
            note: input.note,
          })
          .onConflict((oc) =>
            oc
              .columns(['userId', 'code'])
              .doUpdateSet({ status, note: input.note }),
          )
          .execute();
        return result.length > 0;
      } else {
        const result = await db
          .deleteFrom('visitedCountry')
          .where('userId', '=', ctx.user.id)
          .where('code', '=', input.code)
          .execute();
        return result.length > 0;
      }
    }),
  importFlights: authedProcedure.mutation(async ({ ctx }) => {
    const flights = await listFlights(ctx.user.id);
    const countries: number[] = [];

    for (const flight of flights) {
      const originCountry = countryFromAlpha(flight.from.country);
      const destinationCountry = countryFromAlpha(flight.to.country);
      if (!originCountry || !destinationCountry) {
        continue;
      }

      countries.push(originCountry.numeric);
    }

    if (countries.length === 0) {
      return false;
    }

    const result = await db
      .insertInto('visitedCountry')
      .values(
        countries.map((country) => ({
          userId: ctx.user.id,
          code: country,
          status: 'visited',
        })),
      )
      .onConflict((oc) => oc.doNothing())
      .execute();
    return result.length > 0;
  }),
});
