import { db } from '$lib/db';
import { hashSha256 } from '$lib/server/utils/hash';
import { generateString } from '$lib/server/utils/random';

const OAUTH_LINK_TOKEN_TTL_MS = 10 * 60 * 1000;

export type OAuthLinkAccountResult =
  | { success: true }
  | {
      success: false;
      reason: 'invalid_token' | 'already_linked' | 'duplicate_oauth';
    };

const isUniqueViolation = (error: unknown) => {
  if (typeof error !== 'object' || error === null) return false;
  if ('code' in error && error.code === '23505') return true;
  if ('cause' in error) return isUniqueViolation(error.cause);
  return false;
};

export const createOAuthLinkToken = async (
  userId: string,
  oauthSub: string,
): Promise<string> => {
  await cleanupExpiredOAuthLinkTokens();
  await db.deleteFrom('oauthLinkToken').where('userId', '=', userId).execute();

  const token = generateString();
  await db
    .insertInto('oauthLinkToken')
    .values({
      id: generateString(),
      token: hashSha256(token),
      userId,
      oauthSub,
      expiresAt: new Date(Date.now() + OAUTH_LINK_TOKEN_TTL_MS),
    })
    .execute();

  return token;
};

export const linkOAuthAccount = async (
  userId: string,
  oauthSub: string,
): Promise<OAuthLinkAccountResult> => {
  try {
    return await db.transaction().execute(async (trx) => {
      const user = await trx
        .selectFrom('user')
        .select(['id', 'oauthId'])
        .where('id', '=', userId)
        .forUpdate()
        .executeTakeFirst();

      if (!user) {
        return { success: false, reason: 'invalid_token' };
      }

      if (user.oauthId) {
        return { success: false, reason: 'already_linked' };
      }

      const duplicateUser = await trx
        .selectFrom('user')
        .select(['id'])
        .where('oauthId', '=', oauthSub)
        .executeTakeFirst();
      if (duplicateUser && duplicateUser.id !== userId) {
        return { success: false, reason: 'duplicate_oauth' };
      }

      await trx
        .updateTable('user')
        .set({ oauthId: oauthSub })
        .where('id', '=', userId)
        .execute();

      return { success: true };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: false, reason: 'duplicate_oauth' };
    }
    throw error;
  }
};

export const linkOAuthAccountWithToken = async (
  userId: string,
  token: string,
): Promise<OAuthLinkAccountResult> => {
  try {
    return await db.transaction().execute(async (trx) => {
      const linkToken = await trx
        .selectFrom('oauthLinkToken')
        .selectAll()
        .where('token', '=', hashSha256(token))
        .where('userId', '=', userId)
        .where('expiresAt', '>', new Date())
        .forUpdate()
        .executeTakeFirst();

      if (!linkToken) {
        return { success: false, reason: 'invalid_token' };
      }

      const user = await trx
        .selectFrom('user')
        .select(['id', 'oauthId'])
        .where('id', '=', userId)
        .forUpdate()
        .executeTakeFirst();

      if (!user) {
        return { success: false, reason: 'invalid_token' };
      }

      if (user.oauthId && user.oauthId !== linkToken.oauthSub) {
        return { success: false, reason: 'already_linked' };
      }

      const duplicateUser = await trx
        .selectFrom('user')
        .select(['id'])
        .where('oauthId', '=', linkToken.oauthSub)
        .executeTakeFirst();
      if (duplicateUser && duplicateUser.id !== userId) {
        return { success: false, reason: 'duplicate_oauth' };
      }

      if (!user.oauthId) {
        await trx
          .updateTable('user')
          .set({ oauthId: linkToken.oauthSub })
          .where('id', '=', userId)
          .execute();
      }

      await trx
        .deleteFrom('oauthLinkToken')
        .where('id', '=', linkToken.id)
        .execute();

      return { success: true };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: false, reason: 'duplicate_oauth' };
    }
    throw error;
  }
};

export const cleanupExpiredOAuthLinkTokens = async () => {
  await db
    .deleteFrom('oauthLinkToken')
    .where('expiresAt', '<=', new Date())
    .execute();
};
