import { Kysely } from 'kysely';

import type { DB } from '../../src/lib/db/schema';

import { seedFlight } from './flight';
import { seedUser } from './user';

export const seedDatabase = async (db: Kysely<DB>) => {
  const user = await seedUser(db);
  await seedFlight(db, user.id);
};
