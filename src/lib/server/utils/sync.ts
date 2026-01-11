import { Readable } from 'node:stream';

import * as tar from 'tar';

import { airlinesDataSchema, aircraftListDataSchema } from '$lib/data/types';
import { db } from '$lib/db';
import { appConfig } from '$lib/server/utils/config';
import { uploadManager } from '$lib/server/utils/uploads';

const GITHUB_RAW_BASE_URL =
  'https://raw.githubusercontent.com/johanohly/AirTrail/main';
const GITHUB_TARBALL_URL =
  'https://api.github.com/repos/johanohly/AirTrail/tarball/main';

interface SyncResult {
  added: number;
  updated: number;
  errors: string[];
}

interface IconSyncResult {
  synced: number;
  errors: string[];
}

const logError = (errors: string[], message: string) => {
  console.warn(message);
  errors.push(message);
};

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
      logError(
        result.errors,
        `Failed to fetch airlines.json: ${response.status} ${response.statusText}`,
      );
      return result;
    }

    const json = await response.json();

    let airlines;
    try {
      airlines = airlinesDataSchema.parse(json);
    } catch (err) {
      logError(result.errors, `Invalid airlines.json format: ${err}`);
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
            })
            .execute();
          result.added++;
        }
      } catch (err) {
        logError(
          result.errors,
          `Failed to sync airline ${airline.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  } catch (err) {
    logError(
      result.errors,
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
      logError(
        result.errors,
        `Failed to fetch aircraft.json: ${response.status} ${response.statusText}`,
      );
      return result;
    }

    const json = await response.json();

    let aircraft;
    try {
      aircraft = aircraftListDataSchema.parse(json);
    } catch (err) {
      logError(result.errors, `Invalid aircraft.json format: ${err}`);
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
        logError(
          result.errors,
          `Failed to sync aircraft ${ac.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  } catch (err) {
    logError(
      result.errors,
      `Unexpected error during aircraft sync: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return result;
};

type IconData = { buffer: Buffer; extension: string };

/**
 * Downloads the AirTrail repo tarball and extracts airline icons.
 * Icons are in data/icons/airlines/ named by sourceId (slug).
 * @returns Map of sourceId -> icon data (buffer + extension)
 */
async function fetchAirlineIconsFromGitHub(): Promise<Map<string, IconData>> {
  const sourceIdToIcon = new Map<string, IconData>();

  const response = await fetch(GITHUB_TARBALL_URL, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'AirTrail',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch tarball: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const readable = Readable.from(buffer);

  await new Promise<void>((resolve, reject) => {
    const parser = new tar.Parser({
      filter: (path) => /\/data\/icons\/airlines\/[^/]+\.[a-z]+$/.test(path),
      onReadEntry: (entry) => {
        const chunks: Buffer[] = [];
        entry.on('data', (chunk: Buffer) => chunks.push(chunk));
        entry.on('end', () => {
          const filename = entry.path.split('/').pop();
          if (filename) {
            const sourceId = filename.replace(/\.[^.]+$/, '');
            const extension = filename.substring(filename.lastIndexOf('.'));
            sourceIdToIcon.set(sourceId, {
              buffer: Buffer.concat(chunks),
              extension,
            });
          }
        });
      },
    });

    parser.on('end', resolve);
    parser.on('error', reject);

    readable.pipe(parser);
  });

  return sourceIdToIcon;
}

const hasAnyAirlineWithIcon = async (): Promise<boolean> => {
  const result = await db
    .selectFrom('airline')
    .select('id')
    .where('iconPath', 'is not', null)
    .limit(1)
    .executeTakeFirst();
  return !!result;
};

/**
 * Syncs airline icons from GitHub to the database.
 * Downloads tarball and extracts icons, matching by sourceId.
 *
 * @param options.onlyIfNoIcons If true, only sync if no airlines have icons (for initial install)
 * @param options.overwrite If true, overwrites existing icons. If false, only syncs airlines without iconPath.
 * @returns Object with count of synced icons and any errors
 */
export const syncAirlineIcons = async (options?: {
  onlyIfNoIcons?: boolean;
  overwrite?: boolean;
}): Promise<IconSyncResult> => {
  const result: IconSyncResult = { synced: 0, errors: [] };

  if (!uploadManager.isReady) {
    logError(result.errors, 'Upload manager is not ready. Cannot sync icons.');
    return result;
  }

  if (options?.onlyIfNoIcons && (await hasAnyAirlineWithIcon())) {
    return result;
  }

  let query = db
    .selectFrom('airline')
    .select(['id', 'sourceId', 'iconPath'])
    .where('sourceId', 'is not', null);

  if (!options?.overwrite) {
    query = query.where('iconPath', 'is', null);
  }

  const airlines = await query.execute();
  if (airlines.length === 0) {
    return result;
  }

  let sourceIdToIcon: Map<string, IconData>;
  try {
    console.log('Fetching airline icons from GitHub...');
    sourceIdToIcon = await fetchAirlineIconsFromGitHub();
    console.log(`Found ${sourceIdToIcon.size} icons in repository.`);
  } catch (err) {
    logError(
      result.errors,
      `Failed to fetch icons from GitHub: ${err instanceof Error ? err.message : String(err)}`,
    );
    return result;
  }

  for (const airline of airlines) {
    if (!airline.sourceId) continue;

    const iconData = sourceIdToIcon.get(airline.sourceId);
    if (!iconData) continue;

    try {
      const relativePath = `airlines/${airline.id}${iconData.extension}`;

      if (
        options?.overwrite &&
        airline.iconPath &&
        airline.iconPath !== relativePath
      ) {
        await uploadManager.deleteFile(airline.iconPath);
      }

      const success = await uploadManager.saveFile(
        relativePath,
        iconData.buffer,
      );
      if (!success) {
        logError(
          result.errors,
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
      logError(
        result.errors,
        `Failed to sync icon for ${airline.sourceId}: ${err}`,
      );
    }
  }

  if (result.synced > 0) {
    console.log(`Synced icons for ${result.synced} airline(s).`);
  }

  return result;
};

const markDataSynced = async () => {
  await appConfig.set({ data: { lastSynced: new Date().toISOString() } });
};

export const ensureInitialDataSync = async () => {
  const config = await appConfig.get();
  if (config?.data?.lastSynced) {
    return;
  }

  console.log('Running initial data sync...');
  console.time('Initial data sync');

  const [airlinesResult, aircraftResult] = await Promise.all([
    syncAirlines({ includeDefunct: false }),
    syncAircraft(),
  ]);

  const totalAdded = airlinesResult.added + aircraftResult.added;
  const totalUpdated = airlinesResult.updated + aircraftResult.updated;
  const allErrors = [...airlinesResult.errors, ...aircraftResult.errors];

  if (allErrors.length > 0) {
    console.warn('Initial sync completed with errors:', allErrors);
  }

  if (totalAdded > 0 || totalUpdated > 0) {
    console.log(
      `Initial sync: added ${airlinesResult.added} airlines, ${aircraftResult.added} aircraft`,
    );
  }

  await markDataSynced();
  console.timeEnd('Initial data sync');
};
