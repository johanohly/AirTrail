import { router } from '../trpc';

import { userRouter } from './user';

import { airportRouter } from '$lib/server/routes/airport';
import { autocompleteRouter } from '$lib/server/routes/autocomplete';
import { flightRouter } from '$lib/server/routes/flight';
import { oauthRouter } from '$lib/server/routes/oauth';
import { sqlRouter } from '$lib/server/routes/sql';
import { visitedCountriesRouter } from '$lib/server/routes/visited-countries';

export const appRouter = router({
  user: userRouter,
  airport: airportRouter,
  flight: flightRouter,
  oauth: oauthRouter,
  autocomplete: autocompleteRouter,
  visitedCountries: visitedCountriesRouter,
  sql: sqlRouter,
});

export type AppRouter = typeof appRouter;
