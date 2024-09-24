import { db } from '$lib/db';
import type { AppConfig } from '$lib/db/types';

let appConfigCache: AppConfig | null = null;

export async function fetchAppConfig() {
  if (appConfigCache) return appConfigCache;

  const result = await db
    .selectFrom('appConfig')
    .selectAll()
    .limit(1)
    .execute();

  appConfigCache = result[0] || null;
  return appConfigCache;
}

export async function updateAppConfig(newConfig: Partial<AppConfig>) {
  await db.updateTable('appConfig').set(newConfig).execute();

  appConfigCache = null;
}
