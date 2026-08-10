import { z } from 'zod';

import { authedProcedure, router } from '../trpc';

import { db } from '$lib/db';
import { VisitedCountryStatus } from '$lib/db/types';
import { listFlights } from '$lib/server/utils/flight';
import {
  countryCodesFromFlights,
  countryFromAlpha2,
} from '$lib/utils/data/countries';

const VisitedCountrySchema = z.object({
  code: z
    .string()
    .length(2)
    .refine((code) => countryFromAlpha2(code), {
      message: 'Unknown country code',
    }),
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

    return list.filter((country) => countryFromAlpha2(country.code));
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
    const countries = countryCodesFromFlights(flights);

    if (countries.size === 0) {
      return 0;
    }

    const result = await db
      .insertInto('visitedCountry')
      .values(
        Array.from(countries).map((country) => ({
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
