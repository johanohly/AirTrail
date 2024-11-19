import fs from 'node:fs';
import path from 'node:path';

import { CamelCasePlugin, Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

import type { DB } from '../src/lib/db/schema';

const pool = new pg.Pool({ connectionString: process.env.DB_URL });
const dialect = new PostgresDialect({ pool });

const db = new Kysely<DB>({
  dialect,
  plugins: [new CamelCasePlugin()],
});

const main = async () => {
  const files = fs.readdirSync(path.join(__dirname, './seed'));

  for (const file of files) {
    const stat = fs.statSync(path.join(__dirname, './seed', file));

    if (stat.isFile()) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require(path.join(__dirname, './seed', file));

      if ('seedDatabase' in mod && typeof mod.seedDatabase === 'function') {
        console.log(`[SEEDING]: ${file}`);

        try {
          await mod.seedDatabase(db);
        } catch (e) {
          console.log(`[SEEDING]: Seed failed for ${file}`);
          console.error(e);
        }
      }
    }
  }
};

main()
  .then(() => {
    db.destroy();
  })
  .catch((e) => {
    console.error(e);
    db.destroy();
    process.exit(1);
  });
