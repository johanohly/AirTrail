import { readFile } from '$lib/utils';
import { processFR24File } from '$lib/import/fr24';
import { processAITAFile } from '$lib/import/aita';
import type { CreateFlight } from '$lib/db/types';
import { processJetLogFile } from '$lib/import/jetlog';

export const processFile = async (file: File): Promise<CreateFlight[]> => {
  const content = await readFile(file);

  if (file.name.includes('jetlog')) {
    return processJetLogFile(content);
  } else if (file.name.endsWith('.csv')) {
    return processFR24File(content);
  } else if (file.name.endsWith('.txt')) {
    return processAITAFile(content);
  }

  return [];
};
