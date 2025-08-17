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

export type PlatformValue = (typeof platforms)[number]['value'];

type ProcessResult = { flights: CreateFlight[]; unknownAirports: string[] };

type Processor = (
  content: string,
  options: PlatformOptions,
) => Promise<ProcessResult>;

const processors: Record<PlatformValue, Processor> = {
  airtrail: async (content) => processAirTrailFile(content),
  jetlog: async (content, options) => processJetLogFile(content, options),
  fr24: async (content) => processFR24File(content),
  aita: async (content, options) => processAITAFile(content, options),
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
