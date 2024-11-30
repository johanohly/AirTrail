import { error, json } from '@sveltejs/kit';

import { db, type User } from '$lib/db';
import { hashSha256 } from '$lib/server/utils/hash';

export const validateApiKey = async (
  request: Request,
): Promise<User | null> => {
  const apiKey = request.headers.get('Authorization')?.split('Bearer ')[1];
  if (!apiKey) {
    return null;
  }
  const hash = hashSha256(apiKey);
  const user = await db
    .selectFrom('user')
    .where(
      'id',
      '=',
      db.selectFrom('apiKey').where('key', '=', hash).select('userId'),
    )
    .selectAll()
    .executeTakeFirst();

  if (user) {
    await db
      .updateTable('apiKey')
      .set({ lastUsed: new Date() })
      .where('key', '=', hash)
      .execute();
  }

  return user || null;
};

export const apiError = (message: string, status = 500) => {
  return json({ success: false, message }, { status });
};

export const unauthorized = () => {
  return apiError('Unauthorized', 401);
};
