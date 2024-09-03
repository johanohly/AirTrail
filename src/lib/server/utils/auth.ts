import { db, type User } from '$lib/db';
import { sql } from 'kysely';
import type { Lucia } from 'lucia';
import type { Cookies } from '@sveltejs/kit';

export const createUser = async (
  id: string,
  username: string,
  password: string,
  displayName: string,
  unit: User['unit'],
  role: User['role'],
) => {
  const result = await db
    .insertInto('user')
    .values({ id, username, password, displayName, unit, role })
    .executeTakeFirst();
  return result.numInsertedOrUpdatedRows && result.numInsertedOrUpdatedRows > 0;
};

export const getUser = async (username: string) => {
  return db
    .selectFrom('user')
    .where('username', '=', username)
    .selectAll()
    .executeTakeFirst();
};

export const createSession = async (
  lucia: Lucia,
  userId: string,
  cookies: Cookies,
) => {
  const session = await lucia.createSession(userId, {});
  const sessionCookie = lucia.createSessionCookie(session.id);

  cookies.set(sessionCookie.name, sessionCookie.value, {
    path: '.',
    ...sessionCookie.attributes,
  });
};

export const deleteSession = async (lucia: Lucia, cookies: Cookies) => {
  const sessionCookie = lucia.createBlankSessionCookie();

  cookies.set(sessionCookie.name, sessionCookie.value, {
    path: '.',
    ...sessionCookie.attributes,
  });
};

export const usernameExists = async (username: string) => {
  const users = await db
    .selectFrom('user')
    .where('username', '=', username)
    .select(sql`1`.as('exists'))
    .execute();
  return users.length > 0;
};
