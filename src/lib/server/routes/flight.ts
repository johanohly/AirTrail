import { parseISO } from 'date-fns';
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
import { getFlightRoute } from '$lib/server/utils/flight-lookup/flight-lookup';
import { generateCsv } from '$lib/utils/csv';
import { omit } from '$lib/utils/other';

export const flightRouter = router({
  lookup: authedProcedure
    .input(
      z.object({
        flightNumber: z.string(),
        date: z.string().datetime({ offset: true }).optional(),
      }),
    )
    .query(async ({ input }) => {
      const results = await getFlightRoute(
        input.flightNumber,
        // @ts-expect-error - We know the date string is a full ISO datetime string
        input.date ? { date: parseISO(input.date.split('T')[0]) } : undefined,
      );

      // The below mess is required to maintain timezone through serialization
      return results.map((r) => ({
        ...r,
        departure: r.departure ? r.departure.toISOString() : null,
        departureTz: r.departure ? r.departure.timeZone : null,
        arrival: r.arrival ? r.arrival.toISOString() : null,
        arrivalTz: r.arrival ? r.arrival.timeZone : null,
      }));
    }),
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
    .input(
      z.object({
        flights: z.custom<CreateFlight[]>(),
        dedupe: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx: { user }, input }) => {
      return await createManyFlights(
        input.flights,
        user.id,
        input.dedupe ?? true,
      );
    }),
  exportJson: authedProcedure.query(async ({ ctx: { user } }) => {
    const users = await db
      .selectFrom('user')
      .select(['id', 'displayName', 'username'])
      .execute();
    const res = await listFlights(user.id);
    const flights = res.map((flight) => ({
      ...omit(flight, ['id', 'fromId', 'toId', 'airlineId', 'aircraftId']),
      from: flight.from ? omit(flight.from, ['id']) : null,
      to: flight.to ? omit(flight.to, ['id']) : null,
      airline: flight.airline ? omit(flight.airline, ['id']) : null,
      aircraft: flight.aircraft ? omit(flight.aircraft, ['id']) : null,
      seats: flight.seats.map((seat) => omit(seat, ['id', 'flightId'])),
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
        from: flight.from?.name,
        to: flight.to?.name,
        airline: flight.airline?.name,
        aircraft: flight.aircraft?.name,
        seat: seat?.seat,
        seatNumber: seat?.seatNumber,
        seatClass: seat?.seatClass,
      };
    });

    return generateCsv(flights);
  }),
});
