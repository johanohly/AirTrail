import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { db } from '$lib/db';
import {
  DEFAULT_FLIGHT_SCOPE,
  flightScopeSchema,
  resolveFlightScope,
} from '$lib/flight-scope';
import { authedProcedure, router } from '$lib/server/trpc';
import { reduceFlightTrackForMap } from '$lib/track/render';
import {
  flightTrackPayloadSchema,
  type FlightTrackRow,
  type FlightTrackSourceFormat,
} from '$lib/track/schema';
import {
  canAccessFlight,
  canListFlights,
} from '$lib/server/authorization/flight';

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
    .input(flightScopeSchema.optional().default(DEFAULT_FLIGHT_SCOPE))
    .query(async ({ ctx: { user, authorization }, input }) => {
      if (!canListFlights(authorization, input)) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      const scope = resolveFlightScope(input, user.id);

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

      if (scope.scope === 'user') {
        query = query.where((eb) =>
          eb.exists(
            eb
              .selectFrom('flightPassenger')
              .select('flightPassenger.id')
              .whereRef('flightPassenger.flightId', '=', 'flight.id')
              .where('flightPassenger.userId', '=', scope.userId),
          ),
        );
      }

      const rows = await query.execute();
      return rows.map((row) => parseTrackRow(row, true));
    }),
  get: authedProcedure
    .input(z.number())
    .query(async ({ ctx: { authorization }, input }) => {
      if (!(await canAccessFlight(authorization, 'read', input))) {
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
