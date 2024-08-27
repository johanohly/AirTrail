import { router } from '../trpc';
import { userRouter } from './user';
import { flightRouter } from '$lib/server/routes/flight';
import { airportRouter } from '$lib/server/routes/airport';

export const appRouter = router({
  user: userRouter,
  flight: flightRouter,
  airport: airportRouter,
});

export type AppRouter = typeof appRouter;
