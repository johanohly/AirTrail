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
      // @ts-expect-error - Lucia establishes its own connection so the camel case translation layer does not get applied here
      displayName: db.display_name,
      role: db.role,
      // @ts-expect-error - Same as above
      oauthId: db.oauth_id,
      // @ts-expect-error - Same as above
      distanceUnit: db.distance_unit,
      // @ts-expect-error - Same as above
      windSpeedUnit: db.wind_speed_unit,
      // @ts-expect-error - Same as above
      temperatureUnit: db.temperature_unit,
      // @ts-expect-error - Same as above
      pressureUnit: db.pressure_unit,
      // @ts-expect-error - Same as above
      timeFormat: db.time_format,
      // @ts-expect-error - Same as above
      dateFormat: db.date_format,
      // @ts-expect-error - Same as above
      weekStartsOn: db.week_starts_on,
      // @ts-expect-error - Same as above
      flightTimeDisplay: db.flight_time_display,
    };
  },
});

declare module 'lucia' {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: DB['user'];
  }
}
