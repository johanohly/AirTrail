import { db } from '$lib/db';
import type { RunwayEnd } from '$lib/db/types';

// Looks up a non-closed runway at the given airport by either of its end
// identifiers e.g. 23L (case-insensitive), returning the runway's id and 
// which end ('le' or 'he') matched the provided ident.
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
