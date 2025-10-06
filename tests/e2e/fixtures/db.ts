import { test as base } from '@playwright/test';
import { db } from '@test/db';
import type { Kysely } from 'kysely';

import type { DB } from '$lib/db/schema';

export const test = base.extend<{ db: Kysely<DB> }>({
  db: async ({ page: _ }, use) => {
    await use(db);
  },
});
