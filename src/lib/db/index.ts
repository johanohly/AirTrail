import {
  CamelCasePlugin,
  Kysely,
  type RawBuilder,
  sql,
  SqliteDialect,
} from 'kysely';
import Database from 'better-sqlite3';
import { DATABASE_URL } from '$env/static/private';
import type { DB, Flight } from './schema';

export const sqlite = new Database(DATABASE_URL);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = new Kysely<DB>({
  dialect: new SqliteDialect({
    database: sqlite,
  }),
  plugins: [new CamelCasePlugin()],
});

export function json<T>(obj: T): RawBuilder<T> {
  return sql`${JSON.stringify(obj)}`;
}

export type APIFlight = Omit<Flight, 'id'> & { id: number };
