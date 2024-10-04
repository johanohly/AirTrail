import { router } from '../trpc';
import { userRouter } from './user';
import { flightRouter } from '$lib/server/routes/flight';
import { autocompleteRouter } from '$lib/server/routes/autocomplete';
import { oauthRouter } from '$lib/server/routes/oauth';
import { visitedCountriesRouter } from '$lib/server/routes/visited-countries';

export const appRouter = router({
  user: userRouter,
  flight: flightRouter,
  oauth: oauthRouter,
  autocomplete: autocompleteRouter,
  visitedCountries: visitedCountriesRouter,
});

export type AppRouter = typeof appRouter;
