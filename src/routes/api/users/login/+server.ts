import { actionResult, superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

import type { RequestHandler } from './$types';

import { db } from '$lib/db';
import { lucia } from '$lib/server/auth';
import { createSession, getUser } from '$lib/server/utils/auth';
import { verifyArgon2 } from '$lib/server/utils/hash';
import { consumeOAuthLinkToken } from '$lib/server/utils/oauth-link-token';
import { signInSchema } from '$lib/zod/auth';

export const POST: RequestHandler = async ({ cookies, request }) => {
  const form = await superValidate(request, zod(signInSchema));
  if (!form.valid) {
    return actionResult('failure', { form });
  }

  const { username, password, oauthLinkToken } = form.data;

  const user = await getUser(username);
  if (!user || !user.password) {
    form.message = { type: 'error', text: 'Invalid username or password' };
    return actionResult('failure', { form });
  }

  const validPassword = await verifyArgon2(user.password, password);
  if (!validPassword) {
    form.message = { type: 'error', text: 'Invalid username or password' };
    return actionResult('failure', { form });
  }

  if (oauthLinkToken) {
    const linkToken = await consumeOAuthLinkToken(oauthLinkToken);
    if (!linkToken || linkToken.userId !== user.id) {
      form.message = {
        type: 'error',
        text: 'Invalid or expired OAuth link token',
      };
      return actionResult('failure', { form });
    }

    if (user.oauthId && user.oauthId !== linkToken.oauthSub) {
      form.message = {
        type: 'error',
        text: 'User is already linked to an OAuth account',
      };
      return actionResult('failure', { form });
    }

    const duplicateUser = await db
      .selectFrom('user')
      .select(['id'])
      .where('oauthId', '=', linkToken.oauthSub)
      .executeTakeFirst();
    if (duplicateUser && duplicateUser.id !== user.id) {
      form.message = {
        type: 'error',
        text: 'OAuth account is already linked to another user',
      };
      return actionResult('failure', { form });
    }

    await db
      .updateTable('user')
      .set({ oauthId: linkToken.oauthSub })
      .where('id', '=', user.id)
      .execute();
  }

  await createSession(lucia, user.id, cookies);

  return actionResult('redirect', '/', 303);
};
