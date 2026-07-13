import { parseISO } from 'date-fns';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { authedProcedure, router } from '../trpc';

import { db } from '$lib/db';
import type { CreateFlight } from '$lib/db/types';
import {
  createFlight,
  listAllFlights,
  createManyFlights,
  deleteFlight,
  listFlights,
  validateFlightDates,
} from '$lib/server/utils/flight';
import { getAircraftFromReg } from '$lib/server/utils/flight-lookup/aerodatabox';
import { getFlightRoute } from '$lib/server/utils/flight-lookup/flight-lookup';
import { validateFlightImportPermissions } from '$lib/server/utils/flight-import';
import { generateCsv } from '$lib/utils/csv';
import { generateBackup, serializeBackup } from '$lib/server/utils/backup';

const flightListInput = z
  .object({
    scope: z.enum(['mine', 'user', 'all']).default('mine'),
    userId: z.string().optional(),
  })
  .optional();

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

      const [onlyFlight] = results;
      if (results.length === 1 && onlyFlight?.aircraftReg) {
        onlyFlight.aircraft = await getAircraftFromReg(onlyFlight.aircraftReg);
      }

      // The below mess is required to maintain timezone through serialization
      return results.map((r) => ({
        ...r,
        departure: r.departure ? r.departure.toISOString() : null,
        departureTz: r.departure ? r.departure.timeZone : null,
        arrival: r.arrival ? r.arrival.toISOString() : null,
        arrivalTz: r.arrival ? r.arrival.timeZone : null,
        departureScheduled: r.departureScheduled
          ? r.departureScheduled.toISOString()
          : null,
        arrivalScheduled: r.arrivalScheduled
          ? r.arrivalScheduled.toISOString()
          : null,
      }));
    }),
  lookupAircraftByReg: authedProcedure
    .input(z.string())
    .query(async ({ input }) => {
      return await getAircraftFromReg(input);
    }),
  list: authedProcedure
    .input(flightListInput)
    .query(async ({ ctx: { user }, input }) => {
      const scope = input?.scope ?? 'mine';

      if (scope === 'mine') {
        return await listFlights(user.id);
      }

      if (user.role === 'user') {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      if (scope === 'user') {
        if (!input?.userId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'A user is required for this scope',
          });
        }

        return await listFlights(input.userId);
      }

      return await listAllFlights();
    }),
  delete: authedProcedure
    .input(z.number())
    .mutation(async ({ ctx: { user }, input }) => {
      const seats = await db
        .selectFrom('seat')
        .selectAll()
        .where('flightId', '=', input)
        .execute();

      if (
        user.role === 'user' &&
        !seats.some((seat) => seat.userId === user.id)
      ) {
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

      if (user.role === 'user' && flightIds.length !== input.length) {
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
      const dateError = validateFlightDates(input);
      if (dateError) {
        throw new Error(dateError);
      }
      await createFlight(input);
    }),
  createMany: authedProcedure
    .input(
      z.object({
        flights: z.custom<CreateFlight[]>(),
        dedupe: z.boolean().optional(),
        mode: z.enum(['personal', 'restore']).default('personal'),
      }),
    )
    .mutation(async ({ ctx: { user }, input }) => {
      for (const flight of input.flights) {
        const dateError = validateFlightDates(flight);
        if (dateError) {
          throw new Error(dateError);
        }
      }
      const permissionError = validateFlightImportPermissions(
        user,
        input.flights,
        input.mode,
      );
      if (permissionError) {
        throw new TRPCError({ code: 'FORBIDDEN', message: permissionError });
      }

      return await createManyFlights(
        input.flights,
        user.id,
        input.dedupe ?? true,
        input.mode,
      );
    }),
  exportJson: authedProcedure.query(async ({ ctx: { user } }) => {
    const backup = await generateBackup({ scope: 'mine', userId: user.id });
    return serializeBackup(backup, 'json');
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
