import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { db } from '$lib/db';
import { authedProcedure, router } from '$lib/server/trpc';
import { reduceFlightTrackForMap } from '$lib/track/render';
import {
  flightTrackPayloadSchema,
  type FlightTrackRow,
  type FlightTrackSourceFormat,
} from '$lib/track/schema';

const flightTrackListInput = z
  .object({
    scope: z.enum(['mine', 'user', 'all']).default('mine'),
    userId: z.string().optional(),
  })
  .optional();

const parseTrackRow = (
  row: {
    flightId: number;
    track: unknown;
    sourceFormat: FlightTrackSourceFormat;
    sourceName: string | null;
    pointCount: number;
  },
  reduceForMap = false,
): FlightTrackRow => {
  const track = flightTrackPayloadSchema.parse(row.track);
  return {
    flightId: row.flightId,
    ...(reduceForMap ? reduceFlightTrackForMap(track) : track),
    sourceFormat: row.sourceFormat,
    sourceName: row.sourceName,
    pointCount: row.pointCount,
  };
};

export const flightTrackRouter = router({
  list: authedProcedure
    .input(flightTrackListInput)
    .query(async ({ ctx: { user }, input }) => {
      const scope = input?.scope ?? 'mine';

      if (user.role === 'user' && scope !== 'mine') {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      if (scope === 'user' && !input?.userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'A user is required for this scope',
        });
      }

      let query = db
        .selectFrom('flightTrack')
        .innerJoin('flight', 'flight.id', 'flightTrack.flightId')
        .select([
          'flightTrack.flightId',
          'flightTrack.track',
          'flightTrack.sourceFormat',
          'flightTrack.sourceName',
          'flightTrack.pointCount',
        ]);

      let scopedUserId: string | null | undefined = null;
      if (scope === 'mine') {
        scopedUserId = user.id;
      } else if (scope === 'user') {
        scopedUserId = input?.userId;
      }

      if (scopedUserId) {
        query = query.where((eb) =>
          eb.exists(
            eb
              .selectFrom('flightPassenger')
              .select('flightPassenger.id')
              .whereRef('flightPassenger.flightId', '=', 'flight.id')
              .where('flightPassenger.userId', '=', scopedUserId),
          ),
        );
      }

      const rows = await query.execute();
      return rows.map((row) => parseTrackRow(row, true));
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

      const row = await db
        .selectFrom('flightTrack')
        .select([
          'flightTrack.flightId',
          'flightTrack.track',
          'flightTrack.sourceFormat',
          'flightTrack.sourceName',
          'flightTrack.pointCount',
        ])
        .where('flightId', '=', input)
        .executeTakeFirst();

      return row ? parseTrackRow(row) : null;
    }),
});
