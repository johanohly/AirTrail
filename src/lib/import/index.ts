import { processAirTrailFile } from '$lib/import/airtrail';
import { processAITAFile } from '$lib/import/aita';
import { processByAirFile } from '$lib/import/byair';
import { processFlightyFile } from '$lib/import/flighty';
import { processFR24File } from '$lib/import/fr24';
import { processJetLogFile } from '$lib/import/jetlog';
import { processJetLoversFile } from '$lib/import/jetlovers';
import { processLegacyAirTrailFile } from '$lib/import/legacy-airtrail';
import type { PlatformOptions, ProcessResult } from '$lib/import/model';
import { processMilesAndMoreFile } from '$lib/import/milesandmore';
import { processOpenFlightsFile } from '$lib/import/openflights';
import { type PlatformValue } from '$lib/import/platforms';
import { processTripItFile } from '$lib/import/tripit';
import { readFile } from '$lib/utils';

type Processor = (
  content: string,
  options: PlatformOptions,
) => Promise<ProcessResult>;

const processors: Record<PlatformValue, Processor> = {
  airtrail: processAirTrailFile,
  'legacy-airtrail': processLegacyAirTrailFile,
  jetlog: processJetLogFile,
  fr24: processFR24File,
  aita: processAITAFile,
  tripit: processTripItFile,
  flighty: processFlightyFile,
  byair: processByAirFile,
  jetlovers: processJetLoversFile,
  openflights: processOpenFlightsFile,
  milesandmore: processMilesAndMoreFile,
};

export type { PlatformValue } from '$lib/import/platforms';

export const processFile = async (
  file: File,
  platform: PlatformValue,
  options: PlatformOptions,
): Promise<ProcessResult> => {
  const content = await readFile(file);
  const handler = processors[platform];
  if (!handler) throw new Error('Unknown platform');
  return handler(content, options);
};
