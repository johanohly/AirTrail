import { db } from '$lib/db';
import { measureTrackDistance } from '$lib/track/distance';
import { flightTrackPayloadSchema } from '$lib/track/schema';

/*
 * Measures tracks saved before track distances were stored. It runs in the
 * background after startup rather than in the migration, so a large instance
 * starts at once and shows great-circle distances until it finishes. Tracks
 * are loaded one at a time because each can hold up to 100,000 points.
 */
export const backfillTrackDistances = async () => {
  const pending = await db
    .selectFrom('flightTrack')
    .select('flightId')
    .where('distance', 'is', null)
    .orderBy('flightId')
    .execute();
  let measured = 0;

  for (const { flightId } of pending) {
    const row = await db
      .selectFrom('flightTrack')
      .select('track')
      .where('flightId', '=', flightId)
      .where('distance', 'is', null)
      .executeTakeFirst();
    const track = row && flightTrackPayloadSchema.safeParse(row.track);
    if (!track?.success) continue;

    // A track saved in the meantime was measured on save and is left alone.
    const result = await db
      .updateTable('flightTrack')
      .set({ distance: measureTrackDistance(track.data) })
      .where('flightId', '=', flightId)
      .where('distance', 'is', null)
      .executeTakeFirst();
    if (result.numUpdatedRows > 0n) measured++;
  }

  if (measured) {
    console.log(`Measured the flown distance of ${measured} flight tracks.`);
  }
};
