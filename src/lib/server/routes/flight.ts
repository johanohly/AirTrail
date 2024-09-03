import { authedProcedure, router } from '../trpc';
import { db, type Flight } from '$lib/db';
import { z } from 'zod';

export const flightRouter = router({
  list: authedProcedure.query(async ({ ctx: { user } }) => {
    const flights = await db
      .selectFrom('flight')
      .selectAll()
      .where('userId', '=', user.id)
      .execute();
    return flights;
  }),
  delete: authedProcedure
    .input(z.number())
    .mutation(async ({ ctx: { user }, input }) => {
      await db
        .deleteFrom('flight')
        .where('id', '=', input)
        .where('userId', '=', user.id)
        .execute();
    }),
  create: authedProcedure
    .input(z.custom<Omit<Flight, 'id' | 'userId'>>())
    .mutation(async ({ ctx: { user }, input }) => {
      await db
        .insertInto('flight')
        .values({ ...input, userId: user.id })
        .execute();
    }),
  createMany: authedProcedure
    .input(z.custom<Omit<Flight, 'id' | 'userId'>[]>())
    .mutation(async ({ ctx: { user }, input }) => {
      const flights = input.map((flight) => ({ ...flight, userId: user.id }));
      await db.insertInto('flight').values(flights).execute();
    }),
});
