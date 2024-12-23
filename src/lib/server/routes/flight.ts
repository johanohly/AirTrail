import { z } from 'zod';

import { authedProcedure, router } from '../trpc';

import { db } from '$lib/db';
import type { CreateFlight } from '$lib/db/types';
import {
  createFlight,
  createManyFlights,
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
  deleteMany: authedProcedure
    .input(z.array(z.number()))
    .mutation(async ({ ctx: { user }, input }) => {
      const result = await db
        .selectFrom('seat')
        .select('flightId')
        .distinct()
        .where('userId', '=', user.id)
        .where('flightId', 'in', input)
        .execute();
      const flightIds = result.map((r) => r.flightId);

      if (flightIds.length !== input.length) {
        throw new Error('You do not have a seat on all flights');
      }

      await db.deleteFrom('flight').where('id', 'in', input).execute();
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
            eb(eb.fn.count('seat.id'), '-', eb.lit(1)),
          ),
        ]),
      )
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
    .mutation(async ({ input }) => {
      await createManyFlights(input);
    }),
  exportJson: authedProcedure.query(async ({ ctx: { user } }) => {
    const users = await db
      .selectFrom('user')
      .select(['id', 'displayName', 'username'])
      .execute();
    const res = await listFlights(user.id);
    const flights = res.map(({ id: _, ...flight }) => ({
      ...flight,
      seats: flight.seats.map(({ id: _, flightId: __, ...seat }) => ({
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
    const flights = res.map(({ id: _, seats, ...flight }) => {
      const seat = seats.find((seat) => seat.userId === user.id);

      return {
        ...flight,
        from: flight.from.code,
        to: flight.to.code,
        seat: seat?.seat,
        seatNumber: seat?.seatNumber,
        seatClass: seat?.seatClass,
      };
    });

    return generateCsv(flights);
  }),
});
