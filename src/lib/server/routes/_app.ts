import { router } from '../trpc';

import { userRouter } from './user';

import { aircraftRouter } from '$lib/server/routes/aircraft';
import { airlineRouter } from '$lib/server/routes/airline';
import { airportRouter } from '$lib/server/routes/airport';
import { autocompleteRouter } from '$lib/server/routes/autocomplete';
import { customFieldRouter } from '$lib/server/routes/custom-field';
import { flightRouter } from '$lib/server/routes/flight';
import { oauthRouter } from '$lib/server/routes/oauth';
import { shareRouter } from '$lib/server/routes/share';
import { sqlRouter } from '$lib/server/routes/sql';
import { visitedCountriesRouter } from '$lib/server/routes/visited-countries';

export const appRouter = router({
  user: userRouter,
  aircraft: aircraftRouter,
  airline: airlineRouter,
  airport: airportRouter,
  flight: flightRouter,
  customField: customFieldRouter,
  oauth: oauthRouter,
  autocomplete: autocompleteRouter,
  share: shareRouter,
  visitedCountries: visitedCountriesRouter,
  sql: sqlRouter,
});

export type AppRouter = typeof appRouter;
