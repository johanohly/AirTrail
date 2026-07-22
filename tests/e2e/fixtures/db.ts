import { test as base } from '@playwright/test';
import { db } from '@test/db';
import type { Kysely } from 'kysely';

import type { DB } from '$lib/db/schema';
import { DISMISSED_VERSION_KEY } from '$lib/utils/version-storage';

export const test = base.extend<{ db: Kysely<DB>; prepareLocalStorage: void }>({
  db: async ({ page: _ }, use) => {
    await use(db);
  },
  prepareLocalStorage: [
    async ({ page }, use) => {
      await page.addInitScript((dismissedVersionKey) => {
        globalThis.localStorage.setItem(dismissedVersionKey, 'v999.9.9');
      }, DISMISSED_VERSION_KEY);

      await use();
    },
    { auto: true },
  ],
});
