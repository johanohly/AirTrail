import { router } from "../trpc";
import { userRouter } from "./user";
import { flightRouter } from "$lib/server/routes/flight";

export const appRouter = router({
  user: userRouter,
  flight: flightRouter
});

export type AppRouter = typeof appRouter;
