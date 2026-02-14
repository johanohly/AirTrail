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

type ProcessResult = {
  flights: CreateFlight[];
  unknownAirports: Record<string, number[]>; // code -> flight indices
  unknownAirlines: Record<string, number[]>; // code -> flight indices
  unknownUsers: Record<string, number[]>; // encoded user key -> flight indices
  exportedUsers: {
    id: string;
    username: string;
    displayName: string;
    mappedUserId: string | null;
  }[];
};

type Processor = (
  content: string,
  options: PlatformOptions,
) => Promise<ProcessResult>;

const withDefaultUnknownUsers = async (
  fn: () => Promise<Omit<ProcessResult, 'unknownUsers'>>,
): Promise<ProcessResult> => {
  const res = await fn();
  return {
    ...res,
    unknownUsers: {},
    exportedUsers: [],
  };
};

const processors: Record<PlatformValue, Processor> = {
  airtrail: async (content, options) => processAirTrailFile(content, options),
  'legacy-airtrail': async (content, options) =>
    withDefaultUnknownUsers(() => processLegacyAirTrailFile(content, options)),
  jetlog: async (content, options) =>
    withDefaultUnknownUsers(() => processJetLogFile(content, options)),
  fr24: async (content, options) =>
    withDefaultUnknownUsers(() => processFR24File(content, options)),
  aita: async (content, options) =>
    withDefaultUnknownUsers(() => processAITAFile(content, options)),
  tripit: async (content, options) =>
    withDefaultUnknownUsers(() => processTripItFile(content, options)),
  flighty: async (content, options) =>
    withDefaultUnknownUsers(() => processFlightyFile(content, options)),
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
