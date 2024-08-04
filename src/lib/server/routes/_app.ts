import { router, publicProcedure, authedProcedure } from '../trpc';
import { z } from 'zod';

export const appRouter = router({
	greeting: publicProcedure
		.input(
			z.object({
				name: z.string().optional(),
			}),
		)
		.query(({ input }) => {
			return `Welcome to ${input.name ?? 'the world'}!`;
		}),
	me: publicProcedure.query(({ ctx }) => {
		return ctx.user;
	}),
	secret: authedProcedure.query(({ ctx }) => {
		// This is a protected route
		return `Hello, ${ctx.user.username}!`;
	}),
});

export type AppRouter = typeof appRouter;
