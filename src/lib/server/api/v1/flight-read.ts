import { db } from '$lib/db';
import { listFlightBaseQuery } from '$lib/db/queries';
import type { Flight } from '$lib/db/types';
import type { ResolvedFlightScope } from '$lib/flight-scope';
import type { FlightTrackSummary } from '$lib/api/v1/dto';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const encodeCursor = (flight: Pick<Flight, 'date' | 'id'>) =>
  Buffer.from(JSON.stringify({ date: flight.date, id: flight.id })).toString(
    'base64url',
  );

const decodeCursor = (value: string) => {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    );
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const date: unknown = Reflect.get(parsed, 'date');
    const id: unknown = Reflect.get(parsed, 'id');
    return typeof date === 'string' && Number.isSafeInteger(id)
      ? { date, id: Number(id) }
      : null;
  } catch {
    return null;
  }
};

export const parsePage = (limitValue: string | null, cursor: string | null) => {
  const limit = limitValue === null ? DEFAULT_LIMIT : Number(limitValue);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return null;
  }
  if (cursor !== null && !decodeCursor(cursor)) return null;
  return { limit, cursor };
};

export const listFlightsPage = async (
  scope: ResolvedFlightScope,
  page: { limit: number; cursor: string | null },
) => {
  let query = listFlightBaseQuery(
    db,
    scope.scope === 'user' ? scope.userId : undefined,
  )
    .orderBy('flight.date', 'desc')
    .orderBy('flight.id', 'desc');

  const cursor = page.cursor ? decodeCursor(page.cursor) : null;
  if (page.cursor && !cursor) return null;
  if (cursor) {
    query = query.where((eb) =>
      eb.or([
        eb('flight.date', '<', cursor.date),
        eb.and([
          eb('flight.date', '=', cursor.date),
          eb('flight.id', '<', cursor.id),
        ]),
      ]),
    );
  }

  const rows = await query.limit(page.limit + 1).execute();
  const hasNextPage = rows.length > page.limit;
  const flights = (hasNextPage ? rows.slice(0, page.limit) : rows) as Flight[];
  const nextCursor = hasNextPage
    ? encodeCursor(flights[flights.length - 1]!)
    : null;

  const summaries = flights.length
    ? await db
        .selectFrom('flightTrack')
        .select([
          'flightId',
          'pointCount',
          'updatedAt',
          'sourceFormat',
          'sourceName',
        ])
        .where(
          'flightId',
          'in',
          flights.map((flight) => flight.id),
        )
        .execute()
    : [];
  const tracks = new Map<number, FlightTrackSummary>(
    summaries.map((summary) => [
      summary.flightId,
      {
        pointCount: summary.pointCount,
        updatedAt: summary.updatedAt.toISOString(),
        sourceFormat: summary.sourceFormat,
        sourceName: summary.sourceName,
      },
    ]),
  );

  return { flights, tracks, nextCursor };
};
