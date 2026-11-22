import { sql } from 'kysely';

import { db } from '$lib/db';
import type { ResolvedFlightScope } from '$lib/flight-scope';
import {
  flightRank,
  moveBucket,
  planMove,
  type MoveDirection,
} from '$lib/utils/data/flight-order';

const ORDER_COLUMNS = [
  'id',
  'sortKey',
  'date',
  'datePrecision',
  'departure',
  'takeoffActual',
  'departureScheduled',
  'takeoffScheduled',
] as const;

const DATE_PREFIX_LENGTH = { day: 10, month: 7, year: 4 } as const;

/*
 * Moves a flight one place past the next flight of its bucket in `scope`,
 * which is the list the person is looking at, unfiltered. Only the moved
 * flight's key is written, unless the bucket has to be renumbered. Resolves to
 * false when the flight can't move that way.
 */
export const moveFlight = (
  id: number,
  direction: MoveDirection,
  scope: ResolvedFlightScope,
) =>
  db.transaction().execute(async (trx) => {
    const flight = await trx
      .selectFrom('flight')
      .select(ORDER_COLUMNS)
      .where('id', '=', id)
      .forUpdate()
      .executeTakeFirst();
    const bucket = flight && moveBucket(flight);
    if (!flight || !bucket) return false;
    // Two moves in one bucket would each place their flight against a stale
    // read of the other, so they take turns.
    await sql`select pg_advisory_xact_lock(hashtext(${`flight-move:${bucket}`}))`.execute(
      trx,
    );

    const prefix = flight.date.slice(
      0,
      DATE_PREFIX_LENGTH[flight.datePrecision],
    );
    let query = trx
      .selectFrom('flight')
      .select(ORDER_COLUMNS)
      .where('datePrecision', '=', flight.datePrecision)
      .where('date', 'like', `${prefix}%`);
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

    const candidates = await query.execute();
    const ordered = candidates
      .filter((candidate) => moveBucket(candidate) === bucket)
      .sort((a, b) => flightRank(b) - flightRank(a) || b.id - a.id);
    const keys = planMove(ordered, id, direction);
    if (!keys) return false;

    for (const [flightId, sortKey] of keys) {
      await trx
        .updateTable('flight')
        .set({ sortKey })
        .where('id', '=', flightId)
        .execute();
    }
    return true;
  });
