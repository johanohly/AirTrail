import { z } from 'zod';

import { authedProcedure, router } from '../trpc';

import { db } from '$lib/db';
import { VisitedCountryStatus } from '$lib/db/types';
import { listFlights } from '$lib/server/utils/flight';
import {
  countryFromAlpha2,
  countryFromNumeric,
} from '$lib/utils/data/countries';

const VisitedCountrySchema = z.object({
  code: z.number(),
  status: z.enum(VisitedCountryStatus).nullable(),
  note: z.string().nullable(),
});

export const visitedCountriesRouter = router({
  list: authedProcedure.query(async ({ ctx }) => {
    const list = await db
      .selectFrom('visitedCountry')
      .select(['id', 'userId', 'note', 'code', 'status'])
      .where('userId', '=', ctx.user.id)
      .execute();

    return list.map((country) => ({
      ...country,
      numeric: country.code,
      alpha3: countryFromNumeric(country.code)?.alpha3 || 'DNK',
    }));
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
    const countries: Set<number> = new Set();

    for (const flight of flights) {
      if (!flight.from || !flight.to) {
        continue;
      }

      const originCountry = countryFromAlpha2(flight.from.country);
      const destinationCountry = countryFromAlpha2(flight.to.country);
      if (!originCountry || !destinationCountry) {
        continue;
      }

      countries.add(originCountry.numeric);
      countries.add(destinationCountry.numeric);
    }

    if (countries.size === 0) {
      return 0;
    }

    const result = await db
      .insertInto('visitedCountry')
      .values(
        countries
          .values()
          .toArray()
          .map((country) => ({
            userId: ctx.user.id,
            code: country,
            status: 'visited',
          })),
      )
      .onConflict((oc) => oc.columns(['userId', 'code']).doNothing())
      .execute();
    return Number(result?.[0]?.numInsertedOrUpdatedRows || 0);
  }),
});
