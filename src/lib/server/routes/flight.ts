import { authedProcedure, router } from '../trpc';
import { db } from '$lib/db';
import { z } from 'zod';
import type { CreateFlight } from '$lib/db/types';
import {
  createFlight,
  deleteFlight,
  listFlights,
} from '$lib/server/utils/flight';
import { generateCsv } from '$lib/utils/csv';

export const flightRouter = router({
  list: authedProcedure.query(async ({ ctx: { user } }) => {
    return await listFlights(user.id);
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

      const resp = await deleteFlight(input);

      if (!resp.numDeletedRows) {
        throw new Error('Flight not found');
      }
    }),
  create: authedProcedure
    .input(z.custom<CreateFlight>())
    .mutation(async ({ input }) => {
      await createFlight(input);
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
  export: authedProcedure.query(async ({ ctx: { user } }) => {
    const res = await listFlights(user.id);
    const flights = res.map((flight) => ({
      ...flight,
      seats: flight.seats.map((seat) => ({
        ...seat,
        userId: undefined,
      })),
    }));

    return generateCsv(flights);
  }),
});
