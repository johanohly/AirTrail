import { readFile } from "$lib/utils";
import { processFR24File } from "$lib/import/fr24";
import type { Flight } from "$lib/db/schema";

export const processFile = async (file: File): Promise<Omit<Flight, "id" | "userId">[]> => {
  const content = await readFile(file);

  if (file.name.endsWith(".csv")) {
    return processFR24File(content);
  }

  return [];
};