import { router } from '../trpc';
import { userRouter } from './user';
import { flightRouter } from '$lib/server/routes/flight';
import { autocompleteRouter } from '$lib/server/routes/autocomplete';

export const appRouter = router({
  user: userRouter,
  flight: flightRouter,
  autocomplete: autocompleteRouter,
});

export type AppRouter = typeof appRouter;
