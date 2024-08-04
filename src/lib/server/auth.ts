import { Lucia } from 'lucia';
import { BetterSqlite3Adapter } from '@lucia-auth/adapter-sqlite';
import { dev } from '$app/environment';
import type { DB } from '$lib/db/schema';
import { sqlite } from '$lib/db';

const adapter = new BetterSqlite3Adapter(sqlite, {
	user: 'user',
	session: 'session',
});

export const lucia = new Lucia(adapter, {
	sessionCookie: {
		attributes: {
			secure: !dev,
		},
	},
	getUserAttributes(db) {
		return {
			username: db.username,
			password: db.password,
			displayName: db.displayName,
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
