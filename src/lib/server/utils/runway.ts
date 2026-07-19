import { db } from '$lib/db';
import type { RunwayEnd } from '$lib/db/types';

// ident -> runway: given a runway id and end identifier (e.g. '23L'), finds the
// matching non-closed runway at the airport (case-insensitive, matches either
// end) and returns its id plus which end matched ('le' for the low end like
// '05', 'he' for the high end like '23L').
export const getRunwayByIdent = async (
  airportId: number,
  ident: string,
): Promise<{ runwayId: number; end: RunwayEnd } | null> => {
  const id = ident.trim();
  const runway = await db
    .selectFrom('runway')
    .select(['id', 'leIdent', 'heIdent'])
    .where('airportId', '=', airportId)
    .where('closed', '=', false)
    .where((eb) =>
      eb.or([eb('leIdent', 'ilike', id), eb('heIdent', 'ilike', id)]),
    )
    .executeTakeFirst();
  if (!runway) return null;
  const end: RunwayEnd =
    runway.leIdent?.toLowerCase() === id.toLowerCase() ? 'le' : 'he';
  return { runwayId: runway.id, end };
};

// airport -> runways: given an airport id, returns all of its non-closed
// runways (each with its id and both end idents, e.g. leIdent '05' /
// heIdent '23'), ordered by the low-end identifier.
export const getRunwaysByAirport = async (airportId: number) => {
  return await db
    .selectFrom('runway')
    .select(['id', 'leIdent', 'heIdent'])
    .where('airportId', '=', airportId)
    .where('closed', '=', false)
    .orderBy('leIdent')
    .execute();
};

// id -> runway: fetches a single runway by its primary key, returning the
// owning airportId and both end idents (or undefined if no such runway). Note
// this does not filter out closed runways, unlike the lookups above.
export const getRunwayById = async (runwayId: number) => {
  return await db
    .selectFrom('runway')
    .select(['airportId', 'leIdent', 'heIdent'])
    .where('id', '=', runwayId)
    .executeTakeFirst();
};
