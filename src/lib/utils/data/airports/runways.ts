import { sql } from 'kysely';

import { db } from '$lib/db';
import type { Runway } from '$lib/db/types';
import { forEachCsvRow } from '$lib/utils/csv-stream';
import { deepEqual } from '$lib/utils/other';
import { runwaySourceSchema, type RunwaySourceRow } from '$lib/zod/runway';

import { BATCH_SIZE, buildIdentToIcaoMap } from './source';

const RUNWAY_SOURCE_URL =
  'https://davidmegginson.github.io/ourairports-data/runways.csv';

// DB assigns `id`; `sourceId` (the OurAirports runway id) is the stable match key.
type InsertRunway = Omit<Runway, 'id'>;

/*
 * runways.csv `airport_ident` is the airport's source `ident`, but we store
 * airports under an `icao` that createAirportCode may derive from the gps_code
 * or keywords instead. Compose `ident -> icao` (from the source) with
 * `icao -> id` (from the DB) so runways resolve to the right airport.
 */
const buildIdentToAirportIdMap = async () => {
  const [identToIcao, airports] = await Promise.all([
    buildIdentToIcaoMap(),
    db.selectFrom('airport').select(['id', 'icao']).execute(),
  ]);
  const icaoToId = new Map(airports.map((a) => [a.icao.toUpperCase(), a.id]));

  const identToId = new Map<string, number>();
  for (const [ident, icao] of identToIcao) {
    const id = icaoToId.get(icao);
    if (id !== undefined) {
      identToId.set(ident, id);
    }
  }
  return identToId;
};

const toInsertRunway = (
  row: RunwaySourceRow,
  identToAirportId: Map<string, number>,
): InsertRunway | null => {
  const airportId = identToAirportId.get(row.airport_ident.toUpperCase());
  if (airportId === undefined) {
    // best-effort: skip runways whose airport we don't have
    return null;
  }

  return {
    sourceId: row.id,
    airportId,
    length: row.length_ft,
    width: row.width_ft,
    surface: row.surface,
    lighted: row.lighted,
    closed: row.closed,
    leIdent: row.le_ident,
    leLat: row.le_latitude_deg,
    leLon: row.le_longitude_deg,
    leEle: row.le_elevation_ft,
    leHdg: row.le_heading_degT,
    leDispThreshold: row.le_displaced_threshold_ft,
    heIdent: row.he_ident,
    heLat: row.he_latitude_deg,
    heLon: row.he_longitude_deg,
    heEle: row.he_elevation_ft,
    heHdg: row.he_heading_degT,
    heDispThreshold: row.he_displaced_threshold_ft,
  };
};

const forEachRunwaySourceRow = async (
  onRow: (row: RunwaySourceRow) => Promise<void> | void,
) => {
  const res = await fetch(RUNWAY_SOURCE_URL);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch runway source CSV: ${res.status} ${res.statusText}`,
    );
  }
  if (!res.body) {
    throw new Error('Runway source CSV response did not include a body');
  }

  await forEachCsvRow(res.body, runwaySourceSchema, onRow, (row, error) => {
    console.error('Error parsing runway row:', row, error);
  });
};

const insertRunwayBatch = async (
  runways: InsertRunway[],
  executor: typeof db = db,
) => {
  if (runways.length === 0) {
    return;
  }

  await executor.insertInto('runway').values(runways).execute();
  runways.length = 0;
};

const updateRunwayBatch = async (runways: Runway[]) => {
  if (runways.length === 0) {
    return;
  }

  await sql`
    UPDATE runway SET
      airport_id = v.airport_id,
      length = v.length,
      width = v.width,
      surface = v.surface,
      lighted = v.lighted,
      closed = v.closed,
      le_ident = v.le_ident,
      le_lat = v.le_lat,
      le_lon = v.le_lon,
      le_ele = v.le_ele,
      le_hdg = v.le_hdg,
      le_disp_threshold = v.le_disp_threshold,
      he_ident = v.he_ident,
      he_lat = v.he_lat,
      he_lon = v.he_lon,
      he_ele = v.he_ele,
      he_hdg = v.he_hdg,
      he_disp_threshold = v.he_disp_threshold
    FROM (VALUES ${sql.join(
      runways.map(
        (r) =>
          sql`(${r.id}::int, ${r.airportId}::int, ${r.length}::int, ${r.width}::int, ${r.surface}, ${r.lighted}::bool, ${r.closed}::bool, ${r.leIdent}, ${r.leLat}::float8, ${r.leLon}::float8, ${r.leEle}::int, ${r.leHdg}::float8, ${r.leDispThreshold}::float8, ${r.heIdent}, ${r.heLat}::float8, ${r.heLon}::float8, ${r.heEle}::int, ${r.heHdg}::float8, ${r.heDispThreshold}::float8)`,
      ),
    )}) AS v(id, airport_id, length, width, surface, lighted, closed, le_ident, le_lat, le_lon, le_ele, le_hdg, le_disp_threshold, he_ident, he_lat, he_lon, he_ele, he_hdg, he_disp_threshold)
    WHERE runway.id = v.id
  `.execute(db);

  runways.length = 0;
};

/*
 * Populate runways on first run, when the table is empty. Mirrors the initial
 * population branch of ensureAirports. Requires airports to already exist so
 * that airport_ident can be resolved to an airportId.
 */
export const ensureRunways = async () => {
  const existing = await db
    .selectFrom('runway')
    .select('id')
    .limit(1)
    .executeTakeFirst();
  if (existing) {
    return;
  }

  console.log('Populating initial runway database...');
  console.time('Populate initial runway database');

  const identToAirportId = await buildIdentToAirportIdMap();
  let skipped = 0;

  // Insert every batch in a single transaction so an interrupted download or a
  // failed insert rolls the whole population back. Without this, a partial
  // table would look "initialized" on the next startup (the check above returns
  // early) and the missing runways would never be inserted.
  await db.transaction().execute(async (trx) => {
    const batch: InsertRunway[] = [];

    await forEachRunwaySourceRow(async (row) => {
      const runway = toInsertRunway(row, identToAirportId);
      if (!runway) {
        skipped += 1;
        return;
      }

      batch.push(runway);
      if (batch.length >= BATCH_SIZE) {
        await insertRunwayBatch(batch, trx);
      }
    });

    await insertRunwayBatch(batch, trx);
  });

  if (skipped) {
    console.warn(`Skipped ${skipped} runways with no matching airport`);
  }
  console.timeEnd('Populate initial runway database');
};

/*
 * Reconcile the runway table against the current source. Matches existing rows
 * by sourceId and updates in place (so runway.id is stable and flight
 * references survive), inserts new ones, and deletes those that disappeared -
 * except runways still referenced by a flight.
 */
export const updateRunways = async () => {
  const start = Date.now();

  const identToAirportId = await buildIdentToAirportIdMap();
  const existing = await db.selectFrom('runway').selectAll().execute();
  const bySourceId = new Map<number, Runway>(
    existing.map((r) => [r.sourceId, r]),
  );
  const seen = new Set<number>();
  const inserts: InsertRunway[] = [];
  const updates: Runway[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  await forEachRunwaySourceRow(async (row) => {
    const runway = toInsertRunway(row, identToAirportId);
    if (!runway) {
      skipped += 1;
      return;
    }

    seen.add(runway.sourceId);

    const prior = bySourceId.get(runway.sourceId);
    if (!prior) {
      inserts.push(runway);
      created += 1;
      if (inserts.length >= BATCH_SIZE) {
        await insertRunwayBatch(inserts);
      }
      return;
    }

    const { id: _id, ...priorWithoutId } = prior;
    if (!deepEqual(runway, priorWithoutId)) {
      updates.push({ ...runway, id: prior.id });
      updated += 1;
      if (updates.length >= BATCH_SIZE) {
        await updateRunwayBatch(updates);
      }
    }
  });

  await insertRunwayBatch(inserts);
  await updateRunwayBatch(updates);

  // Runways whose source rows disappeared, minus any still referenced by a
  // flight (flight.*_runway_id is ON DELETE SET NULL, so deleting would orphan
  // the flight's runway association).
  const removed = existing.filter((r) => !seen.has(r.sourceId));
  const removedIds = removed.map((r) => r.id);
  const referencedIds =
    removedIds.length > 0
      ? new Set(
          (
            await db
              .selectFrom('flight')
              .select('departureRunwayId as rid')
              .where('departureRunwayId', 'in', removedIds)
              .union(
                db
                  .selectFrom('flight')
                  .select('arrivalRunwayId as rid')
                  .where('arrivalRunwayId', 'in', removedIds),
              )
              .execute()
          ).map((r) => r.rid),
        )
      : new Set<number | null>();

  const safeToRemove = removed.filter((r) => !referencedIds.has(r.id));

  for (let i = 0; i < safeToRemove.length; i += BATCH_SIZE) {
    await db
      .deleteFrom('runway')
      .where(
        'id',
        'in',
        safeToRemove.slice(i, i + BATCH_SIZE).map((r) => r.id),
      )
      .execute();
  }

  return {
    created,
    updated,
    skipped,
    removed: safeToRemove.length,
    retained: removed.length - safeToRemove.length,
    time: Date.now() - start,
  };
};
