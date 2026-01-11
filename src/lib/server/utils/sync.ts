import { db } from '$lib/db';
import { airlinesDataSchema, aircraftListDataSchema } from '$lib/data/types';
import { uploadManager } from '$lib/server/utils/uploads';

const GITHUB_RAW_BASE_URL =
  'https://raw.githubusercontent.com/johanohly/AirTrail/main';

interface SyncResult {
  added: number;
  updated: number;
  errors: string[];
}

interface IconSyncResult {
  synced: number;
  errors: string[];
}

/**
 * Syncs airlines from GitHub JSON data to the database.
 * @param options.overwrite If true, updates existing entries. If false, only adds new entries.
 * @param options.includeDefunct If true, includes defunct airlines. If false, filters them out.
 * @returns Object with counts of added/updated airlines and any errors
 */
export const syncAirlines = async (options?: {
  overwrite?: boolean;
  includeDefunct?: boolean;
}): Promise<SyncResult> => {
  const result: SyncResult = { added: 0, updated: 0, errors: [] };

  try {
    const response = await fetch(`${GITHUB_RAW_BASE_URL}/data/airlines.json`);
    if (!response.ok) {
      result.errors.push(
        `Failed to fetch airlines.json: ${response.status} ${response.statusText}`,
      );
      return result;
    }

    const json = await response.json();

    let airlines;
    try {
      airlines = airlinesDataSchema.parse(json);
    } catch (err) {
      result.errors.push(
        `Invalid airlines.json format: ${err instanceof Error ? err.message : String(err)}`,
      );
      return result;
    }

    const filtered = options?.includeDefunct
      ? airlines
      : airlines.filter((a) => !a.defunct);

    const existing = await db
      .selectFrom('airline')
      .select(['sourceId'])
      .where('sourceId', 'is not', null)
      .execute();
    const existingIds = new Set(existing.map((e) => e.sourceId));

    for (const airline of filtered) {
      try {
        if (existingIds.has(airline.id)) {
          if (options?.overwrite) {
            await db
              .updateTable('airline')
              .set({
                name: airline.name,
                icao: airline.icao,
                iata: airline.iata,
                defunct: !!airline.defunct,
              })
              .where('sourceId', '=', airline.id)
              .execute();
            result.updated++;
          }
        } else {
          await db
            .insertInto('airline')
            .values({
              name: airline.name,
              icao: airline.icao,
              iata: airline.iata,
              sourceId: airline.id,
              iconPath: null,
              defunct: !!airline.defunct,
            })
            .execute();
          result.added++;
        }
      } catch (err) {
        result.errors.push(
          `Failed to sync airline ${airline.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  } catch (err) {
    result.errors.push(
      `Unexpected error during airline sync: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return result;
};

/**
 * Syncs aircraft from GitHub JSON data to the database.
 * @param options.overwrite If true, updates existing entries. If false, only adds new entries.
 * @returns Object with counts of added/updated aircraft and any errors
 */
export const syncAircraft = async (options?: {
  overwrite?: boolean;
}): Promise<SyncResult> => {
  const result: SyncResult = { added: 0, updated: 0, errors: [] };

  try {
    const response = await fetch(`${GITHUB_RAW_BASE_URL}/data/aircraft.json`);
    if (!response.ok) {
      result.errors.push(
        `Failed to fetch aircraft.json: ${response.status} ${response.statusText}`,
      );
      return result;
    }

    const json = await response.json();

    let aircraft;
    try {
      aircraft = aircraftListDataSchema.parse(json);
    } catch (err) {
      result.errors.push(
        `Invalid aircraft.json format: ${err instanceof Error ? err.message : String(err)}`,
      );
      return result;
    }

    const existing = await db
      .selectFrom('aircraft')
      .select(['sourceId'])
      .where('sourceId', 'is not', null)
      .execute();
    const existingIds = new Set(existing.map((e) => e.sourceId));

    for (const ac of aircraft) {
      try {
        if (existingIds.has(ac.id)) {
          if (options?.overwrite) {
            await db
              .updateTable('aircraft')
              .set({
                name: ac.name,
                icao: ac.icao,
              })
              .where('sourceId', '=', ac.id)
              .execute();
            result.updated++;
          }
        } else {
          await db
            .insertInto('aircraft')
            .values({
              name: ac.name,
              icao: ac.icao,
              sourceId: ac.id,
            })
            .execute();
          result.added++;
        }
      } catch (err) {
        result.errors.push(
          `Failed to sync aircraft ${ac.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  } catch (err) {
    result.errors.push(
      `Unexpected error during aircraft sync: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return result;
};

/**
 * Syncs airline icons from GitHub to the database.
 * Downloads icons for airlines with sourceId and saves them via uploadManager.
 * @param options.overwrite If true, syncs all airlines with sourceId. If false, only syncs airlines without iconPath.
 * @returns Object with count of synced icons and any errors
 */
export const syncAirlineIcons = async (options?: {
  overwrite?: boolean;
}): Promise<IconSyncResult> => {
  const result: IconSyncResult = { synced: 0, errors: [] };

  if (!uploadManager.isReady) {
    result.errors.push('Upload manager is not ready. Cannot sync icons.');
    return result;
  }

  try {
    let query = db
      .selectFrom('airline')
      .select(['id', 'sourceId', 'iconPath'])
      .where('sourceId', 'is not', null);

    if (!options?.overwrite) {
      query = query.where('iconPath', 'is', null);
    }

    const airlines = await query.execute();

    for (const airline of airlines) {
      if (!airline.sourceId) continue;

      const iconUrl = `${GITHUB_RAW_BASE_URL}/data/icons/airlines/${airline.sourceId}.svg`;

      try {
        const response = await fetch(iconUrl);
        if (!response.ok) {
          continue;
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        const ext = '.svg';
        const relativePath = `airlines/${airline.id}${ext}`;

        if (
          options?.overwrite &&
          airline.iconPath &&
          airline.iconPath !== relativePath
        ) {
          await uploadManager.deleteFile(airline.iconPath);
        }

        const success = await uploadManager.saveFile(relativePath, buffer);
        if (!success) {
          result.errors.push(
            `Failed to save icon for airline ${airline.sourceId}`,
          );
          continue;
        }

        await db
          .updateTable('airline')
          .set({ iconPath: relativePath })
          .where('id', '=', airline.id)
          .execute();

        result.synced++;
      } catch (err) {
        result.errors.push(
          `Failed to sync icon for ${airline.sourceId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  } catch (err) {
    result.errors.push(
      `Unexpected error during icon sync: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return result;
};
