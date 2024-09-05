import {
  CamelCasePlugin,
  Kysely,
  PostgresDialect,
  type RawBuilder,
  sql,
} from 'kysely';
import pg from 'pg';
import { env } from '$env/dynamic/private';
import type { DB, flight, user } from './schema';

export const pool = new pg.Pool({ connectionString: env.DB_URL });
const dialect = new PostgresDialect({ pool });

export const db = new Kysely<DB>({
  dialect,
  plugins: [new CamelCasePlugin()],
});

export function json<T>(obj: T): RawBuilder<T> {
  return sql`${JSON.stringify(obj)}`;
}

export type User = user;
export type Flight = Omit<flight, 'id'> & {
  id: number;
};
