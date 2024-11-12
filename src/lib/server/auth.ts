import { NodePostgresAdapter } from '@lucia-auth/adapter-postgresql';
import { Lucia } from 'lucia';

import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { pool } from '$lib/db';
import type { DB } from '$lib/db/schema';

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
      // @ts-expect-error - Same as above
      oauthId: db.oauth_id,
    };
  },
});

declare module 'lucia' {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: DB['user'];
  }
}
