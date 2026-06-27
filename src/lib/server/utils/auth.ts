import type { Cookies } from '@sveltejs/kit';
import { sql } from 'kysely';
import type { Lucia } from 'lucia';

import { db } from '$lib/db';
import { publicUserFields, type User } from '$lib/db/types';
import { hashSha256 } from '$lib/server/utils/hash';
import { generateString } from '$lib/server/utils/random';
import type { Preferences } from '$lib/zod/user';

const usernameEquals = (username: string) =>
  sql<boolean>`lower("username") = lower(${username})` as any;

export const createUser = async (
  id: string,
  username: string,
  password: string,
  displayName: string,
  role: User['role'],
  preferences?: Partial<Preferences>,
) => {
  const result = await db
    .insertInto('user')
    .values({
      id,
      username,
      password,
      displayName,
      role,
      ...(preferences ?? {}),
    })
    .executeTakeFirst();
  return result.numInsertedOrUpdatedRows && result.numInsertedOrUpdatedRows > 0;
};

export const getUser = async (username: string) => {
  return db
    .selectFrom('user')
    .where(usernameEquals(username))
    .select(publicUserFields)
    .executeTakeFirst();
};

export const getUserWithPassword = async (username: string) => {
  return db
    .selectFrom('user')
    .where(usernameEquals(username))
    .selectAll()
    .executeTakeFirst();
};

export const getUserWithOAuthId = async (username: string) => {
  return db
    .selectFrom('user')
    .where(usernameEquals(username))
    .select([...publicUserFields, 'oauthId'])
    .executeTakeFirst();
};

export const getUserPasswordHash = async (userId: string) => {
  const user = await db
    .selectFrom('user')
    .select('password')
    .where('id', '=', userId)
    .executeTakeFirst();
  return user?.password ?? null;
};

export const createSessionCookie = async (lucia: Lucia, userId: string) => {
  const session = await lucia.createSession(userId, {});
  return lucia.createSessionCookie(session.id);
};

export const createSession = async (
  lucia: Lucia,
  userId: string,
  cookies: Cookies,
) => {
  const sessionCookie = await createSessionCookie(lucia, userId);

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

export const usernameExists = async (
  username: string,
  excludeUserId?: string,
) => {
  let query = db
    .selectFrom('user')
    .select(sql`1`.as('exists'))
    .where(usernameEquals(username));

  if (excludeUserId) {
    query = query.where('id', '!=', excludeUserId);
  }

  const users = await query.execute();
  return users.length > 0;
};

export const createApiKey = async (userId: string, name: string) => {
  const key = generateString();
  const hash = hashSha256(key);
  const result = await db
    .insertInto('apiKey')
    .values({ name, key: hash, userId })
    .executeTakeFirst();
  return result.numInsertedOrUpdatedRows && result.numInsertedOrUpdatedRows > 0
    ? key
    : null;
};

export const isSetup = async () => {
  const users = await db
    .selectFrom('user')
    .select(sql`1`.as('exists'))
    .limit(1)
    .execute();
  return users.length > 0;
};
