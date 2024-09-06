import { Lucia } from 'lucia';
import { dev } from '$app/environment';
import type { DB } from '$lib/db/schema';
import { NodePostgresAdapter } from '@lucia-auth/adapter-postgresql';
import { pool } from '$lib/db';
import { env } from '$env/dynamic/private';

const adapter = new NodePostgresAdapter(pool, {
  user: 'user',
  session: 'session',
});

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    attributes: {
      secure: !dev && env.ORIGIN?.startsWith('https://'),
    },
  },
  getUserAttributes(db) {
    return {
      username: db.username,
      password: db.password,
      // @ts-expect-error - Lucia establishes its own connection so the camel case translation layer does not get applied here
      displayName: db.display_name,
      unit: db.unit,
      role: db.role,
    };
  },
});

declare module 'lucia' {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: DB['user'];
  }
}
