import { Kysely } from 'kysely';

import type { DB } from '../../src/lib/db/schema';

import { seedUser } from './user';

export const seedDatabase = async (db: Kysely<DB>) => {
  await seedUser(db);
};
