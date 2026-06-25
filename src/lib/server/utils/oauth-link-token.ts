import { db } from '$lib/db';
import { hashSha256 } from '$lib/server/utils/hash';
import { generateString } from '$lib/server/utils/random';

const OAUTH_LINK_TOKEN_TTL_MS = 10 * 60 * 1000;

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

export const consumeOAuthLinkToken = async (token: string) => {
  return db
    .deleteFrom('oauthLinkToken')
    .where('token', '=', hashSha256(token))
    .where('expiresAt', '>', new Date())
    .returningAll()
    .executeTakeFirst();
};

export const cleanupExpiredOAuthLinkTokens = async () => {
  await db
    .deleteFrom('oauthLinkToken')
    .where('expiresAt', '<=', new Date())
    .execute();
};
