import { Readable } from 'node:stream';

import * as tar from 'tar';
import type { ZodSchema } from 'zod';

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

async function fetchJsonData<T>(
  url: string,
  schema: ZodSchema<T>,
  errors: string[],
): Promise<T | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      logError(errors, `Failed to fetch ${url}: ${response.status}`);
      return null;
    }

    const json = await response.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      logError(errors, `Invalid JSON format from ${url}: ${parsed.error}`);
      return null;
    }

    return parsed.data;
  } catch (err) {
    logError(errors, `Failed to fetch ${url}: ${formatError(err)}`);
    return null;
  }
}

const formatError = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

async function upsertAirline(
  airline: {
    id: string;
    name: string;
    icao: string | null;
    iata: string | null;
  },
  existingIds: Set<string | null>,
  overwrite: boolean,
): Promise<'added' | 'updated' | null> {
  const exists = existingIds.has(airline.id);

  if (exists && !overwrite) return null;

  if (exists) {
    await db
      .updateTable('airline')
      .set({ name: airline.name, icao: airline.icao, iata: airline.iata })
      .where('sourceId', '=', airline.id)
      .execute();
    return 'updated';
  }

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
  return 'added';
}

export const syncAirlines = async (options?: {
  overwrite?: boolean;
  includeDefunct?: boolean;
}): Promise<SyncResult> => {
  const result: SyncResult = { added: 0, updated: 0, errors: [] };

  const airlines = await fetchJsonData(
    `${GITHUB_RAW_BASE_URL}/data/airlines.json`,
    airlinesDataSchema,
    result.errors,
  );
  if (!airlines) return result;

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
      const action = await upsertAirline(
        airline,
        existingIds,
        options?.overwrite ?? false,
      );
      if (action === 'added') result.added++;
      if (action === 'updated') result.updated++;
    } catch (err) {
      logError(
        result.errors,
        `Failed to sync airline ${airline.id}: ${formatError(err)}`,
      );
    }
  }

  return result;
};

async function upsertAircraft(
  aircraft: { id: string; name: string; icao: string | null },
  existingIds: Set<string | null>,
  overwrite: boolean,
): Promise<'added' | 'updated' | null> {
  const exists = existingIds.has(aircraft.id);

  if (exists && !overwrite) return null;

  if (exists) {
    await db
      .updateTable('aircraft')
      .set({ name: aircraft.name, icao: aircraft.icao })
      .where('sourceId', '=', aircraft.id)
      .execute();
    return 'updated';
  }

  await db
    .insertInto('aircraft')
    .values({ name: aircraft.name, icao: aircraft.icao, sourceId: aircraft.id })
    .execute();
  return 'added';
}

export const syncAircraft = async (options?: {
  overwrite?: boolean;
}): Promise<SyncResult> => {
  const result: SyncResult = { added: 0, updated: 0, errors: [] };

  const aircraft = await fetchJsonData(
    `${GITHUB_RAW_BASE_URL}/data/aircraft.json`,
    aircraftListDataSchema,
    result.errors,
  );
  if (!aircraft) return result;

  const existing = await db
    .selectFrom('aircraft')
    .select(['sourceId'])
    .where('sourceId', 'is not', null)
    .execute();
  const existingIds = new Set(existing.map((e) => e.sourceId));

  for (const ac of aircraft) {
    try {
      const action = await upsertAircraft(
        ac,
        existingIds,
        options?.overwrite ?? false,
      );
      if (action === 'added') result.added++;
      if (action === 'updated') result.updated++;
    } catch (err) {
      logError(
        result.errors,
        `Failed to sync aircraft ${ac.id}: ${formatError(err)}`,
      );
    }
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

interface AirlineForIconSync {
  id: number;
  sourceId: string | null;
  iconPath: string | null;
}

async function syncSingleAirlineIcon(
  airline: AirlineForIconSync,
  iconData: IconData,
  overwrite: boolean,
): Promise<boolean> {
  const relativePath = `airlines/${airline.id}${iconData.extension}`;
  const oldIconPath = airline.iconPath;

  const success = await uploadManager.saveFile(relativePath, iconData.buffer);
  if (!success) return false;

  const shouldDeleteOld =
    overwrite && oldIconPath && oldIconPath !== relativePath;
  if (shouldDeleteOld) {
    await uploadManager.deleteFile(oldIconPath);
  }

  await db
    .updateTable('airline')
    .set({ iconPath: relativePath })
    .where('id', '=', airline.id)
    .execute();

  return true;
}

async function getAirlinesForIconSync(
  overwrite: boolean,
): Promise<AirlineForIconSync[]> {
  let query = db
    .selectFrom('airline')
    .select(['id', 'sourceId', 'iconPath'])
    .where('sourceId', 'is not', null);

  if (!overwrite) {
    query = query.where('iconPath', 'is', null);
  }

  return query.execute();
}

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

  const airlines = await getAirlinesForIconSync(options?.overwrite ?? false);
  if (airlines.length === 0) return result;

  let sourceIdToIcon: Map<string, IconData>;
  try {
    console.log('Fetching airline icons from GitHub...');
    sourceIdToIcon = await fetchAirlineIconsFromGitHub();
    console.log(`Found ${sourceIdToIcon.size} icons in repository.`);
  } catch (err) {
    logError(
      result.errors,
      `Failed to fetch icons from GitHub: ${formatError(err)}`,
    );
    return result;
  }

  for (const airline of airlines) {
    if (!airline.sourceId) continue;

    const iconData = sourceIdToIcon.get(airline.sourceId);
    if (!iconData) continue;

    try {
      const synced = await syncSingleAirlineIcon(
        airline,
        iconData,
        options?.overwrite ?? false,
      );
      if (synced) {
        result.synced++;
      } else {
        logError(
          result.errors,
          `Failed to save icon for airline ${airline.sourceId}`,
        );
      }
    } catch (err) {
      logError(
        result.errors,
        `Failed to sync icon for ${airline.sourceId}: ${formatError(err)}`,
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
