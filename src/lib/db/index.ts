import {
  CamelCasePlugin,
  Kysely,
  PostgresDialect,
  type RawBuilder,
  sql,
} from 'kysely';
import pg from 'pg';
import { DATABASE_URL } from '$env/static/private';
import type { DB, flight, user } from './schema';

const dialect = new PostgresDialect({
  pool: new pg.Pool({ connectionString: DATABASE_URL }),
});

export const db = new Kysely<DB>({
  dialect,
  plugins: [new CamelCasePlugin()],
});

export function json<T>(obj: T): RawBuilder<T> {
  return sql`${JSON.stringify(obj)}`;
}

export type User = user;
export type Flight = flight;
export type APIFlight = Omit<flight, 'id'> & { id: number };
