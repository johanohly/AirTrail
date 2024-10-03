import { authedProcedure, router } from '../trpc';
import { db } from '$lib/db';
import { listFlights } from '$lib/server/utils/flight';
import { airportFromICAO } from '$lib/utils/data/airports';
import { countryFromAlpha } from '$lib/utils/data/countries';

export const visitedCountriesRouter = router({
  list: authedProcedure.query(async ({ ctx }) => {
    return await db
      .selectFrom('visitedCountry')
      .select(['note', 'code', 'status'])
      .where('userId', '=', ctx.user.id)
      .execute();
  }),
  importFlights: authedProcedure.mutation(async ({ ctx }) => {
    const flights = await listFlights(ctx.user.id);
    const countries: number[] = [];

    for (const flight of flights) {
      const origin = airportFromICAO(flight.from);
      const destination = airportFromICAO(flight.to);
      if (!origin || !destination) {
        continue;
      }

      const originCountry = countryFromAlpha(origin.country);
      const destinationCountry = countryFromAlpha(destination.country);
      if (!originCountry || !destinationCountry) {
        continue;
      }

      countries.push(originCountry.numeric);
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
