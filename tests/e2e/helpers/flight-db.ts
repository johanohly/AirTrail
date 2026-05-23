import { db } from '@test/db';

/**
 * Return the most recent flight on (fromId → toId) seated to `userId`. The
 * user filter is essential: tests run in parallel and all reuse the same
 * `getOrCreate` airports, so a route-only lookup races against other workers'
 * flights and returns whichever happened to commit last.
 */
export const latestFlightFor = (userId: string, fromId: number, toId: number) =>
  db
    .selectFrom('flight')
    .innerJoin('seat', 'seat.flightId', 'flight.id')
    .select([
      'flight.id',
      'date',
      'departure',
      'arrival',
      'datePrecision',
      'duration',
    ])
    .where('seat.userId', '=', userId)
    .where('flight.fromId', '=', fromId)
    .where('flight.toId', '=', toId)
    .orderBy('flight.id', 'desc')
    .executeTakeFirstOrThrow();

/**
 * Normalize a DB-returned ISO string to canonical `…Z` form. Postgres/Kysely
 * may serialize UTC instants with `+00:00` instead of `Z`; both are valid
 * ISO-8601 but `toBe()` does string equality, so tests assert on the canonical
 * form returned by `new Date(...).toISOString()`.
 */
export const isoInstant = (s: string | null): string | null =>
  s ? new Date(s).toISOString() : null;
