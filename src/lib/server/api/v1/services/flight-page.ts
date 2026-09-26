import { db } from '$lib/db';
import { listFlightBaseQuery } from '$lib/db/queries';
import type { Flight } from '$lib/db/types';
import type { ResolvedFlightScope } from '$lib/flight-scope';
import type { FlightTrackSummary } from '$lib/api/v1/dto';

export type DecodedCursor = { date: string; id: number };

/** A page request whose cursor has already been decoded and trusted. */
export type FlightPage = { limit: number; cursor: DecodedCursor | null };

export const encodeCursor = (flight: Pick<Flight, 'date' | 'id'>) =>
  Buffer.from(JSON.stringify({ date: flight.date, id: flight.id })).toString(
    'base64url',
  );

export const decodeCursor = (value: string): DecodedCursor | null => {
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

export const listFlightsPage = async (
  scope: ResolvedFlightScope,
  page: FlightPage,
) => {
  let query = listFlightBaseQuery(
    db,
    scope.scope === 'user' ? scope.userId : undefined,
  )
    .orderBy('flight.date', 'desc')
    .orderBy('flight.id', 'desc');

  const cursor = page.cursor;
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

/** The same track summary shape the list endpoint embeds, for a single flight. */
export const getFlightTrackSummary = async (
  flightId: number,
): Promise<FlightTrackSummary | null> => {
  const row = await db
    .selectFrom('flightTrack')
    .select(['pointCount', 'updatedAt', 'sourceFormat', 'sourceName'])
    .where('flightId', '=', flightId)
    .executeTakeFirst();
  return row
    ? {
        pointCount: row.pointCount,
        updatedAt: row.updatedAt.toISOString(),
        sourceFormat: row.sourceFormat,
        sourceName: row.sourceName,
      }
    : null;
};
