import { json } from '@sveltejs/kit';

import { db } from '$lib/db';
import type { User } from '$lib/db/types';
import {
  loadAuthorizationContext,
  type AuthorizationContext,
} from '$lib/server/authorization/context';
import { hashSha256 } from '$lib/server/utils/hash';

export type ApiKeyAuthentication = {
  user: User;
  authorization: AuthorizationContext;
};

export const authenticateApiKey = async (
  request: Request,
): Promise<ApiKeyAuthentication | null> => {
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

  if (!user) return null;

  const authorization = await loadAuthorizationContext(user.id);
  if (!authorization) return null;
  return { user, authorization };
};

export const apiError = (message: string, status = 500) => {
  return json({ success: false, message }, { status });
};

export const unauthorized = () => {
  return apiError('Unauthorized', 401);
};

export const forbidden = () => {
  return apiError('Forbidden', 403);
};
