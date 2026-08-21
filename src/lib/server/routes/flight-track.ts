import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { db } from '$lib/db';
import { authedProcedure, router } from '$lib/server/trpc';
import {
  getFlightTrack,
  listAllFlightTracks,
  listFlightTracks,
} from '$lib/server/utils/flight-track';

const flightTrackListInput = z
  .object({
    scope: z.enum(['mine', 'user', 'all']).default('mine'),
    userId: z.string().optional(),
  })
  .optional();

export const flightTrackRouter = router({
  list: authedProcedure
    .input(flightTrackListInput)
    .query(async ({ ctx: { user }, input }) => {
      const scope = input?.scope ?? 'mine';

      if (scope === 'mine') {
        return await listFlightTracks(user.id, { reduceForMap: true });
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

        return await listFlightTracks(input.userId, { reduceForMap: true });
      }

      return await listAllFlightTracks({ reduceForMap: true });
    }),
  get: authedProcedure
    .input(z.number())
    .query(async ({ ctx: { user }, input }) => {
      const flight = await db
        .selectFrom('flight')
        .select('flight.id')
        .where('flight.id', '=', input)
        .where((eb) =>
          user.role === 'user'
            ? eb.exists(
                eb
                  .selectFrom('flightPassenger')
                  .select('flightPassenger.id')
                  .whereRef('flightPassenger.flightId', '=', 'flight.id')
                  .where('flightPassenger.userId', '=', user.id),
              )
            : eb.val(true),
        )
        .executeTakeFirst();

      if (!flight) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      return await getFlightTrack(input);
    }),
});
