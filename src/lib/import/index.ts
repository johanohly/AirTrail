import {
  platforms,
  type PlatformOptions,
} from '$lib/components/modals/settings/pages/import-page';
import type { CreateFlight } from '$lib/db/types';
import { processAirTrailFile } from '$lib/import/airtrail';
import { processAITAFile } from '$lib/import/aita';
import { processFR24File } from '$lib/import/fr24';
import { processJetLogFile } from '$lib/import/jetlog';
import { readFile } from '$lib/utils';

const Platform = platforms.map((platform) => platform.value)[0];

export const processFile = async (
  file: File,
  platform: typeof Platform,
  options: PlatformOptions,
): Promise<{ flights: CreateFlight[]; unknownAirports: string[] }> => {
  const content = await readFile(file);

  if (platform === 'airtrail') {
    return await processAirTrailFile(content);
  } else if (platform === 'jetlog') {
    return await processJetLogFile(content, options);
  } else if (platform === 'fr24') {
    return await processFR24File(content);
  } else if (platform === 'aita') {
    return await processAITAFile(content, options);
  }

  throw new Error('Unknown platform');
};
