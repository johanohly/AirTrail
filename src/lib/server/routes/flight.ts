import { authedProcedure, router } from '../trpc';
import { db, type Flight } from '$lib/db';
import { z } from 'zod';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import type { CreateFlight } from '$lib/db/types';

export const flightRouter = router({
  list: authedProcedure.query(async ({ ctx: { user } }) => {
    const flights = await db
      .selectFrom('flight')
      .selectAll('flight')
      .select((eb) => [
        jsonArrayFrom(
          eb
            .selectFrom('seat')
            .selectAll()
            .whereRef('seat.flightId', '=', 'flight.id'),
        ).as('seats'),
      ])
      .where((eb) =>
        eb.exists(
          eb
            .selectFrom('seat')
            .select('seat.id')
            .whereRef('seat.flightId', '=', 'flight.id')
            .where('seat.userId', '=', user.id),
        ),
      )
      .execute();

    return flights;
  }),
  delete: authedProcedure
    .input(z.number())
    .mutation(async ({ ctx: { user }, input }) => {
      const seats = await db
        .selectFrom('seat')
        .selectAll()
        .where('flightId', '=', input)
        .execute();

      if (!seats.some((seat) => seat.userId === user.id)) {
        throw new Error('You do not have a seat on this flight');
      }

      const resp = await db
        .deleteFrom('flight')
        .where('id', '=', input)
        .executeTakeFirst();

      if (!resp.numDeletedRows) {
        throw new Error('Flight not found');
      }
    }),
  create: authedProcedure
    .input(z.custom<Omit<Flight, 'id' | 'userId'>>())
    .mutation(async ({ ctx: { user }, input }) => {
      await db.transaction().execute(async (trx) => {
        const flight = await trx
          .insertInto('flight')
          .values(input)
          .returning('id')
          .executeTakeFirstOrThrow();

        const seatData = input.seats.map((seat) => ({
          flightId: flight.id,
          userId: seat.userId || user.id,
          seat: seat.seat,
          seatNumber: seat.seatNumber,
          seatClass: seat.seatClass,
        }));

        return await trx.insertInto('seat').values(seatData).executeTakeFirst();
      });
    }),
  createMany: authedProcedure
    .input(z.custom<CreateFlight[]>())
    .mutation(async ({ ctx: { user }, input }) => {
      await db.transaction().execute(async (trx) => {
        const flights = await trx
          .insertInto('flight')
          .values(input.map(({ seats, ...rest }) => rest))
          .returning('id')
          .execute();

        const seatData = flights.flatMap((flight, index) => {
          const flightInput = input[index];

          if (
            flightInput &&
            flightInput.seats &&
            flightInput.seats.length > 0
          ) {
            return flightInput.seats.map((seat) => ({
              flightId: flight.id,
              userId: seat.userId || user.id,
              seat: seat.seat,
              seatNumber: seat.seatNumber,
              seatClass: seat.seatClass,
            }));
          } else {
            return [];
          }
        });
        if (seatData.length === 0) {
          throw new Error('No seats provided');
        }

        return await trx.insertInto('seat').values(seatData).execute();
      });
    }),
});
