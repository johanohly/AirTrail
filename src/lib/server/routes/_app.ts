import { router } from '../trpc';

import { userRouter } from './user';

import { aircraftRouter } from '$lib/server/routes/aircraft';
import { airlineRouter } from '$lib/server/routes/airline';
import { airportRouter } from '$lib/server/routes/airport';
import { autocompleteRouter } from '$lib/server/routes/autocomplete';
import { flightRouter } from '$lib/server/routes/flight';
import { oauthRouter } from '$lib/server/routes/oauth';
import { sqlRouter } from '$lib/server/routes/sql';
import { visitedCountriesRouter } from '$lib/server/routes/visited-countries';

export const appRouter = router({
  user: userRouter,
  aircraft: aircraftRouter,
  airline: airlineRouter,
  airport: airportRouter,
  flight: flightRouter,
  oauth: oauthRouter,
  autocomplete: autocompleteRouter,
  visitedCountries: visitedCountriesRouter,
  sql: sqlRouter,
});

export type AppRouter = typeof appRouter;
