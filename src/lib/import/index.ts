import {
  platforms,
  type PlatformOptions,
} from '$lib/components/modals/settings/pages/import-page';
import type { CreateFlight } from '$lib/db/types';
import { processAirTrailFile } from '$lib/import/airtrail';
import { processAITAFile } from '$lib/import/aita';
import { processFlightyFile } from '$lib/import/flighty';
import { processFR24File } from '$lib/import/fr24';
import { processJetLogFile } from '$lib/import/jetlog';
import { processLegacyAirTrailFile } from '$lib/import/legacy-airtrail';
import { processTripItFile } from '$lib/import/tripit';
import { readFile } from '$lib/utils';

export type PlatformValue = (typeof platforms)[number]['value'];

type ProcessResult = { flights: CreateFlight[]; unknownAirports: string[] };

type Processor = (
  content: string,
  options: PlatformOptions,
) => Promise<ProcessResult>;

const processors: Record<PlatformValue, Processor> = {
  airtrail: async (content, options) => processAirTrailFile(content, options),
  'legacy-airtrail': async (content, options) =>
    processLegacyAirTrailFile(content, options),
  jetlog: async (content, options) => processJetLogFile(content, options),
  fr24: async (content, options) => processFR24File(content, options),
  aita: async (content, options) => processAITAFile(content, options),
  tripit: async (content, options) => processTripItFile(content, options),
  flighty: async (content, options) => processFlightyFile(content, options),
};

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
