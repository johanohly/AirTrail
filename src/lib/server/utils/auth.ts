import type { Cookies } from '@sveltejs/kit';
import { sql } from 'kysely';
import type { Lucia } from 'lucia';

import { db } from '$lib/db';
import { publicUserFields, type DatabaseConnection } from '$lib/db/types';
import { hashSha256 } from '$lib/server/utils/hash';
import { generateString } from '$lib/server/utils/random';
import type { Preferences } from '$lib/zod/user';
import type { ApiScope } from '$lib/api/v1/scopes';

const usernameEquals = (username: string) =>
  sql<boolean>`lower("username") = lower(${username})` as any;

export const createUser = async ({
  id,
  username,
  password,
  displayName,
  roleId,
  preferences,
  isOwner = false,
  connection = db,
}: {
  id: string;
  username: string;
  password: string;
  displayName: string;
  roleId: string | null;
  preferences?: Partial<Preferences>;
  isOwner?: boolean;
  connection?: DatabaseConnection;
}) => {
  const result = await connection
    .insertInto('user')
    .values({
      id,
      username,
      password,
      displayName,
      roleId,
      isOwner,
      ...(preferences ?? {}),
    })
    .executeTakeFirst();
  return result.numInsertedOrUpdatedRows && result.numInsertedOrUpdatedRows > 0;
};

export const getDefaultRoleId = async () =>
  (
    await db
      .selectFrom('authorizationSettings')
      .select('defaultRoleId')
      .where('id', '=', 1)
      .executeTakeFirstOrThrow()
  ).defaultRoleId;

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
  connection: DatabaseConnection = db,
) => {
  let query = connection
    .selectFrom('user')
    .select(sql`1`.as('exists'))
    .where(usernameEquals(username));

  if (excludeUserId) {
    query = query.where('id', '!=', excludeUserId);
  }

  const users = await query.execute();
  return users.length > 0;
};

export const createApiKey = async (
  userId: string,
  name: string,
  scopes: readonly ApiScope[],
) => {
  const key = generateString();
  const hash = hashSha256(key);
  // Returns the row id too, so callers can render the new key optimistically
  // with its real identity instead of inventing a placeholder.
  const row = await db
    .insertInto('apiKey')
    .values({
      name,
      key: hash,
      userId,
      scopes: [...new Set(scopes)],
    })
    .returning(['id', 'createdAt'])
    .executeTakeFirst();
  return row ? { key, id: row.id, createdAt: row.createdAt } : null;
};

export const isSetup = async () => {
  const users = await db
    .selectFrom('user')
    .select(sql`1`.as('exists'))
    .limit(1)
    .execute();
  return users.length > 0;
};
