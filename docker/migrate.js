/**
 * Lightweight migration runner — replaces `prisma migrate deploy`.
 *
 * Reads SQL files from prisma/migrations/ and applies them in order,
 * tracking state in the _prisma_migrations table (Prisma-compatible).
 */

import { createHash, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'prisma', 'migrations');

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                  VARCHAR(36)  PRIMARY KEY NOT NULL,
    "checksum"            VARCHAR(64)  NOT NULL,
    "finished_at"         TIMESTAMPTZ,
    "migration_name"      VARCHAR(255) NOT NULL,
    "logs"                TEXT,
    "rolled_back_at"      TIMESTAMPTZ,
    "started_at"          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER      NOT NULL DEFAULT 0
  );
`;

async function migrate() {
  const client = new pg.Client({ connectionString: process.env.DB_URL });
  await client.connect();

  try {
    await client.query(CREATE_TABLE);

    const { rows: applied } = await client.query(
      'SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL',
    );
    const appliedSet = new Set(applied.map((r) => r.migration_name));

    const pending = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
      .filter((name) => !appliedSet.has(name));

    if (pending.length === 0) {
      console.log('No pending migrations.');
      return;
    }

    console.log(`Applying ${pending.length} migration(s)...`);

    for (const name of pending) {
      const sqlPath = join(MIGRATIONS_DIR, name, 'migration.sql');
      const sql = readFileSync(sqlPath, 'utf-8');
      const checksum = createHash('sha256').update(sql).digest('hex');

      console.log(`  ${name}`);

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO _prisma_migrations (id, checksum, migration_name, finished_at, applied_steps_count)
           VALUES ($1, $2, $3, now(), 1)`,
          [randomUUID(), checksum, name],
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration "${name}" failed: ${err.message}`);
      }
    }

    console.log('All migrations applied.');
  } finally {
    await client.end();
  }
}

migrate().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
