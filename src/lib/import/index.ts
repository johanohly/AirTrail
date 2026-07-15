import {
  platforms,
  type PlatformOptions,
} from '$lib/components/modals/settings/pages/import-page';
import type { CreateFlight } from '$lib/db/types';
import { processAirTrailFile } from '$lib/import/airtrail';
import { processAITAFile } from '$lib/import/aita';
import { processByAirFile } from '$lib/import/byair';
import { processFlightyFile } from '$lib/import/flighty';
import { processFR24File } from '$lib/import/fr24';
import { processJetLoversFile } from '$lib/import/jetlovers';
import { processJetLogFile } from '$lib/import/jetlog';
import { processLegacyAirTrailFile } from '$lib/import/legacy-airtrail';
import { processOpenFlightsFile } from '$lib/import/openflights';
import { processTripItFile } from '$lib/import/tripit';
import { readFile } from '$lib/utils';

export type PlatformValue = (typeof platforms)[number]['value'];

type ProcessResult = {
  flights: CreateFlight[];
  unknownAirports: Record<string, number[]>; // code -> flight indices
  unknownAirlines: Record<string, number[]>; // code -> flight indices
  unknownAircraft: Record<string, number[]>; // name -> flight indices
  unknownUsers: Record<string, number[]>; // encoded user key -> flight indices
  exportedUsers: {
    id: string;
    username: string;
    displayName: string;
    mappedUserId: string | null;
  }[];
  skippedRows?: number;
};

type Processor = (
  content: string,
  options: PlatformOptions,
) => Promise<ProcessResult>;

const withDefaultUnknownValues = async (
  fn: () => Promise<Partial<ProcessResult>>,
): Promise<ProcessResult> => {
  const res = await fn();
  return {
    ...res,
    unknownUsers: res.unknownUsers ?? {},
    exportedUsers: res.exportedUsers ?? [],
    unknownAircraft: res.unknownAircraft ?? {},
  } as ProcessResult;
};

const processors: Record<PlatformValue, Processor> = {
  airtrail: async (content, options) => 
    withDefaultUnknownValues(() => processAirTrailFile(content, options)),
  'legacy-airtrail': async (content, options) =>
    withDefaultUnknownValues(() => processLegacyAirTrailFile(content, options)),
  jetlog: async (content, options) =>
    withDefaultUnknownValues(() => processJetLogFile(content, options)),
  fr24: async (content, options) =>
    withDefaultUnknownValues(() => processFR24File(content, options)),
  aita: async (content, options) =>
    withDefaultUnknownValues(() => processAITAFile(content, options)),
  tripit: async (content, options) =>
    withDefaultUnknownValues(() => processTripItFile(content, options)),
  flighty: async (content, options) =>
    withDefaultUnknownValues(() => processFlightyFile(content, options)),
  byair: async (content, options) =>
    withDefaultUnknownValues(() => processByAirFile(content, options)),
  jetlovers: async (content, options) =>
    withDefaultUnknownValues(() => processJetLoversFile(content, options)),
  openflights: async (content, options) =>
    withDefaultUnknownValues(() => processOpenFlightsFile(content, options)),
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
