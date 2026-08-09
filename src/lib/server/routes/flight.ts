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
import { hasPermission } from '$lib/server/authorization/authorize';
import { canAccessFlight } from '$lib/server/authorization/flight';
import type { Permission } from '$lib/authorization/permissions';

const requireFlightCreation = (
  authorization: Parameters<typeof hasPermission>[0],
  passengers: Array<{ userId: string | null }>,
) => {
  const includesActor = passengers.some(
    (passenger) => passenger.userId === authorization.userId,
  );
  const scope = includesActor ? 'own' : 'any';
  if (!hasPermission(authorization, `flight.create.${scope}` as Permission)) {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  if (
    passengers.length > 1 &&
    !hasPermission(
      authorization,
      `flight.passengers.manage.${scope}` as Permission,
    )
  ) {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
};

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
        preferredRoute: z
          .object({
            from: z.string().optional(),
            to: z.string().optional(),
          })
          .optional(),
      }),
    )
    .query(async ({ input }) => {
      const results = await getFlightRoute(input.flightNumber, {
        // @ts-expect-error - We know the date string is a full ISO datetime string
        date: input.date ? parseISO(input.date.split('T')[0]) : undefined,
        preferredRoute: input.preferredRoute,
      });

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
    .query(async ({ ctx: { user, authorization }, input }) => {
      const scope = input?.scope ?? 'mine';

      if (scope === 'mine') {
        if (!hasPermission(authorization, 'flight.read.own')) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        return await listFlights(user.id);
      }

      if (!hasPermission(authorization, 'flight.read.any')) {
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
    .mutation(async ({ ctx: { authorization }, input }) => {
      if (!(await canAccessFlight(authorization, 'delete', input))) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const resp = await deleteFlight(input);

      if (!resp.numDeletedRows) {
        throw new Error('Flight not found');
      }
    }),
  deleteMany: authedProcedure
    .input(z.array(z.number()))
    .mutation(async ({ ctx: { user, authorization }, input }) => {
      const result = await db
        .selectFrom('flightPassenger')
        .select('flightId')
        .distinct()
        .where('userId', '=', user.id)
        .where('flightId', 'in', input)
        .execute();
      const flightIds = result.map((r) => r.flightId);

      if (
        !hasPermission(authorization, 'flight.delete.any') &&
        (!hasPermission(authorization, 'flight.delete.own') ||
          flightIds.length !== new Set(input).size)
      ) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      await db.deleteFrom('flight').where('id', 'in', input).execute();
    }),
  deleteAll: authedProcedure.mutation(
    async ({ ctx: { user, authorization } }) => {
      if (!hasPermission(authorization, 'flight.delete.own')) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      const flightIds = await db
        .selectFrom('flight')
        .innerJoin('flightPassenger', 'flightPassenger.flightId', 'flight.id')
        .select('flight.id')
        .groupBy('flight.id')
        .having((eb) =>
          eb.and([
            eb(
              eb.fn.count(
                eb
                  .case()
                  .when('flightPassenger.userId', '=', user.id)
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
                  .when('flightPassenger.userId', 'is', null)
                  .then(1)
                  .else(null)
                  .end(),
              ),
              '=',
              eb(eb.fn.count('flightPassenger.id'), '-', eb.lit(1)),
            ),
          ]),
        )
        .execute();

      if (flightIds.length === 0) {
        return;
      }

      const idsToDelete = flightIds.map((f) => f.id);
      await db.deleteFrom('flight').where('id', 'in', idsToDelete).execute();
    },
  ),
  create: authedProcedure
    .input(z.custom<CreateFlight>())
    .mutation(async ({ ctx: { authorization }, input }) => {
      requireFlightCreation(authorization, input.passengers);
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
    .mutation(async ({ ctx: { user, authorization }, input }) => {
      for (const flight of input.flights) {
        const dateError = validateFlightDates(flight);
        if (dateError) {
          throw new Error(dateError);
        }
      }
      const permissionError = validateFlightImportPermissions(
        authorization,
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
  exportJson: authedProcedure.query(
    async ({ ctx: { user, authorization } }) => {
      // The personal export intentionally remains separate from general read.
      // It is a bulk data operation.
      if (!hasPermission(authorization, 'flight.export.own')) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      const backup = await generateBackup({ scope: 'mine', userId: user.id });
      return serializeBackup(backup, 'json');
    },
  ),
  exportCsv: authedProcedure.query(async ({ ctx: { user, authorization } }) => {
    if (!hasPermission(authorization, 'flight.export.own')) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    const res = await listFlights(user.id);
    const flights = res.map(({ id: _, passengers, ...flight }) => {
      const passenger = passengers.find(
        (passenger) => passenger.userId === user.id,
      );

      return {
        ...flight,
        from: flight.from?.name,
        to: flight.to?.name,
        airline: flight.airline?.name,
        aircraft: flight.aircraft?.name,
        seat: passenger?.seat,
        seatNumber: passenger?.seatNumber,
        seatClass: passenger?.seatClass,
        flightReason: passenger?.flightReason,
      };
    });

    return generateCsv(flights);
  }),
});
