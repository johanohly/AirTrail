import { CamelCasePlugin, Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

import type { DB } from '$lib/db/schema';

const pool = new pg.Pool({ connectionString: process.env.DB_URL });
const dialect = new PostgresDialect({ pool });

export const db = new Kysely<DB>({
  dialect,
  plugins: [new CamelCasePlugin()],
});
