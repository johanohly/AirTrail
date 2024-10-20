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
import { sql } from 'kysely';

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
  deleteAll: authedProcedure.mutation(async ({ ctx: { user } }) => {
    const flightIds = await db
      .selectFrom('flight')
      .innerJoin('seat', 'seat.flightId', 'flight.id')
      .select('flight.id')
      .groupBy('flight.id')
      .having((eb) =>
        eb.and([
          eb(
            eb.fn.count(
              eb
                .case()
                .when('seat.userId', '=', user.id)
                .then(1)
                .else(null)
                .end(),
            ),
            '=',
            1,
          ),
          eb(
            eb.fn.count(
              eb
                .case()
                .when('seat.userId', 'is', null)
                .then(1)
                .else(null)
                .end(),
            ),
            '=',
            eb.fn.count('seat.id') - 1,
          ),
        ]),
      )
      .where('seat.userId', '=', user.id)
      .execute();

    if (flightIds.length === 0) {
      return;
    }

    const idsToDelete = flightIds.map((f) => f.id);
    await db.deleteFrom('flight').where('id', 'in', idsToDelete).execute();
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
              userId: seat.userId || (seat.guestName ? null : user.id),
              guestName: seat.guestName,
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
  exportJson: authedProcedure.query(async ({ ctx: { user } }) => {
    const users = await db
      .selectFrom('user')
      .select(['id', 'displayName', 'username'])
      .execute();
    const res = await listFlights(user.id);
    const flights = res.map(({ id, ...flight }) => ({
      ...flight,
      seats: flight.seats.map(({ id, flightId, ...seat }) => ({
        ...seat,
      })),
    }));
    return JSON.stringify(
      {
        users,
        flights,
      },
      null,
      2,
    );
  }),
  exportCsv: authedProcedure.query(async ({ ctx: { user } }) => {
    const res = await listFlights(user.id);
    const flights = res.map(({ id, seats, ...flight }) => {
      const seat = seats.find((seat) => seat.userId === user.id);

      return {
        ...flight,
        seat: seat?.seat,
        seatNumber: seat?.seatNumber,
        seatClass: seat?.seatClass,
      };
    });

    return generateCsv(flights);
  }),
});
