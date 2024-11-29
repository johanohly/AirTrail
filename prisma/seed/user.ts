import { Kysely } from 'kysely';
import { generateId } from 'lucia';

import type { DB } from '../../src/lib/db/schema';
import { generateHash } from '../../src/lib/server/utils/hash';

export const SEED_USER = {
  username: 'test',
  password: 'password',
  displayName: 'Test User',
  role: 'owner',
  unit: 'metric',
} as const;

export const seedUser = async (db: Kysely<DB>) => {
  return await db
    .insertInto('user')
    .values({
      ...SEED_USER,
      id: generateId(15),
      password: await generateHash(SEED_USER.password),
    })
    .returning('id')
    .executeTakeFirstOrThrow();
};
