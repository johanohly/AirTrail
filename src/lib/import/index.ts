import { readFile } from '$lib/utils';
import { processFR24File } from '$lib/import/fr24';
import type { Flight } from '$lib/db';
import { processAITAFile } from '$lib/import/aita';

export const processFile = async (
  file: File,
): Promise<Omit<Flight, 'id' | 'userId'>[]> => {
  const content = await readFile(file);

  if (file.name.endsWith('.csv')) {
    return processFR24File(content);
  } else if (file.name.endsWith('.txt')) {
    return processAITAFile(content);
  }

  return [];
};
