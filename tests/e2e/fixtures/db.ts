import { test as base } from '@playwright/test';
import { db } from '@test/db';
import type { Kysely } from 'kysely';

import type { DB } from '$lib/db/schema';

export const test = base.extend<{ db: Kysely<DB>; prepareLocalStorage: void }>({
  db: async ({ page: _ }, use) => {
    await use(db);
  },
  prepareLocalStorage: [
    async ({ page }, use) => {
      await page.addInitScript(() => {
        globalThis.localStorage.setItem('dismissedVersion', 'v999.9.9');
      });

      await use();
    },
    { auto: true },
  ],
});
