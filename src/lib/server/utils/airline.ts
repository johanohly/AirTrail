import { Readable } from 'stream';
import * as tar from 'tar';
import { z } from 'zod';

import { db } from '$lib/db';
import type { Airline } from '$lib/db/types';
import { uploadManager } from '$lib/server/utils/uploads';
import type { ErrorActionResult } from '$lib/utils/forms';
import type { airlineSchema } from '$lib/zod/airline';

export const getAirline = async (id: number): Promise<Airline | null> => {
  return (
    (await db
      .selectFrom('airline')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()) ?? null
  );
};

export const getAirlineByIcao = async (
  input: string,
): Promise<Airline | null> => {
  return (
    (await db
      .selectFrom('airline')
      .selectAll()
      .where('icao', 'ilike', input)
      .executeTakeFirst()) ?? null
  );
};

export const getAirlineByName = async (
  input: string,
): Promise<Airline | null> => {
  return (
    (await db
      .selectFrom('airline')
      .selectAll()
      .where('name', 'ilike', input)
      .executeTakeFirst()) ?? null
  );
};

export const findAirline = async (input: string): Promise<Airline[] | null> => {
  return await db
    .selectFrom('airline')
    .selectAll()
    .where((eb) =>
      eb.or([
        eb('name', 'ilike', `%${input}%`),
        eb('icao', 'ilike', `%${input}%`),
        eb('iata', 'ilike', `%${input}%`),
      ]),
    )
    .orderBy('name')
    .limit(10)
    .execute();
};

export const createAirline = async (data: Omit<Airline, 'id'>) => {
  await db.insertInto('airline').values(data).execute();
};

export const updateAirline = async (data: Airline) => {
  await db.updateTable('airline').set(data).where('id', '=', data.id).execute();
};

export const validateAndSaveAirline = async (
  airline: z.infer<typeof airlineSchema>,
): Promise<ErrorActionResult> => {
  const existingAirline = airline.id ? await getAirline(airline.id) : null;

  if (existingAirline) {
    try {
      // Don't update iconPath - it's managed separately via the icon upload API
      await db
        .updateTable('airline')
        .set({
          name: airline.name,
          icao: airline.icao,
          iata: airline.iata,
        })
        .where('id', '=', existingAirline.id)
        .execute();
    } catch (_) {
      return {
        success: false,
        type: 'error',
        message: 'Failed to update airline',
      };
    }

    return {
      success: true,
      message: 'Airline updated',
    };
  } else {
    try {
      await createAirline({
        name: airline.name,
        icao: airline.icao,
        iata: airline.iata,
        iconPath: airline.iconPath ?? null,
      });
    } catch (_) {
      return {
        success: false,
        type: 'error',
        message: 'Failed to create airline',
      };
    }

    return {
      success: true,
      message: 'Airline created',
    };
  }
};

export const validateAirlineIcons = async (): Promise<void> => {
  if (!uploadManager.isConfigured) {
    return;
  }

  const airlines = await db
    .selectFrom('airline')
    .select(['id', 'iconPath'])
    .where('iconPath', 'is not', null)
    .execute();

  for (const airline of airlines) {
    if (airline.iconPath && !uploadManager.fileExists(airline.iconPath)) {
      console.warn(
        `Airline ${airline.id} has missing icon file: ${airline.iconPath}. Setting to null.`,
      );
      await db
        .updateTable('airline')
        .set({ iconPath: null })
        .where('id', '=', airline.id)
        .execute();
    }
  }
};

const GITHUB_TARBALL_URL =
  'https://api.github.com/repos/johanohly/AirTrail/tarball/main';

type IconData = { buffer: Buffer; extension: string };

/**
 * Downloads the AirTrail repo tarball and extracts airline icons.
 * @returns Map of ICAO code (uppercase) -> icon data (buffer + extension)
 */
async function fetchAirlineIconsFromGitHub(): Promise<Map<string, IconData>> {
  const icaoToIcon = new Map<string, IconData>();

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
      filter: (path) => {
        // Match paths like: johanohly-AirTrail-abc123/static/airlines/AAR.svg
        return /\/static\/airlines\/[A-Z0-9]+\.[a-z]+$/.test(path);
      },
      onReadEntry: (entry) => {
        const chunks: Buffer[] = [];
        entry.on('data', (chunk: Buffer) => chunks.push(chunk));
        entry.on('end', () => {
          // Extract ICAO and extension from filename: .../static/airlines/AAR.svg
          const filename = entry.path.split('/').pop();
          if (filename) {
            const icao = filename.replace(/\.[^.]+$/, '').toUpperCase();
            const extension = filename.substring(filename.lastIndexOf('.'));
            icaoToIcon.set(icao, {
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

  return icaoToIcon;
}

/**
 * Populates default airline icons from GitHub for airlines without icons.
 * Downloads the repo tarball once and extracts all icons, avoiding rate limits.
 * @param options.onlyIfNoIcons If true, only populate if no airlines have icons (for initial install)
 * @param options.overwrite If true, overwrite existing icons with defaults (for manual re-import)
 * @returns Number of icons populated
 */
export const populateDefaultAirlineIcons = async (options?: {
  onlyIfNoIcons?: boolean;
  overwrite?: boolean;
}): Promise<number> => {
  if (!uploadManager.isReady) {
    return 0;
  }

  // For initial install: check if any airline already has an icon
  if (options?.onlyIfNoIcons) {
    const anyWithIcon = await db
      .selectFrom('airline')
      .select('id')
      .where('iconPath', 'is not', null)
      .limit(1)
      .executeTakeFirst();

    if (anyWithIcon) {
      return 0;
    }
  }

  // Get airlines that need icons
  let query = db
    .selectFrom('airline')
    .select(['id', 'icao', 'iconPath'])
    .where('icao', 'is not', null);

  // If not overwriting, only get airlines without icons
  if (!options?.overwrite) {
    query = query.where('iconPath', 'is', null);
  }

  const airlines = await query.execute();

  if (airlines.length === 0) {
    return 0;
  }

  console.log(`Fetching default airline icons from GitHub...`);

  let icaoToIcon: Map<string, IconData>;
  try {
    icaoToIcon = await fetchAirlineIconsFromGitHub();
  } catch (err) {
    console.warn('Failed to fetch airline icons from GitHub:', err);
    return 0;
  }

  console.log(`Found ${icaoToIcon.size} icons in repository.`);

  let populated = 0;

  for (const airline of airlines) {
    if (!airline.icao) continue;

    const icao = airline.icao.toUpperCase();
    const iconData = icaoToIcon.get(icao);

    if (!iconData) {
      continue;
    }

    const relativePath = `airlines/${airline.id}${iconData.extension}`;

    // Delete old icon if overwriting and path is different
    if (
      options?.overwrite &&
      airline.iconPath &&
      airline.iconPath !== relativePath
    ) {
      await uploadManager.deleteFile(airline.iconPath);
    }

    const success = await uploadManager.saveFile(relativePath, iconData.buffer);

    if (success) {
      await db
        .updateTable('airline')
        .set({ iconPath: relativePath })
        .where('id', '=', airline.id)
        .execute();
      populated++;
    }
  }

  if (populated > 0) {
    console.log(`Populated default icons for ${populated} airline(s).`);
  }

  return populated;
};
