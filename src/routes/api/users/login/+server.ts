import { actionResult, superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

import type { RequestHandler } from './$types';

import { lucia } from '$lib/server/auth';
import { createSession, getUserWithPassword } from '$lib/server/utils/auth';
import { verifyArgon2 } from '$lib/server/utils/hash';
import { linkOAuthAccountWithToken } from '$lib/server/utils/oauth-link-token';
import { signInSchema } from '$lib/zod/auth';

export const POST: RequestHandler = async ({ cookies, request }) => {
  const form = await superValidate(request, zod(signInSchema));
  if (!form.valid) {
    return actionResult('failure', { form });
  }

  const { username, password, oauthLinkToken } = form.data;

  const user = await getUserWithPassword(username);
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
    const linkResult = await linkOAuthAccountWithToken(user.id, oauthLinkToken);
    if (!linkResult.success && linkResult.reason === 'invalid_token') {
      form.message = {
        type: 'error',
        text: 'Invalid or expired OAuth link token',
      };
      return actionResult('failure', { form });
    }

    if (!linkResult.success && linkResult.reason === 'already_linked') {
      form.message = {
        type: 'error',
        text: 'User is already linked to an OAuth account',
      };
      return actionResult('failure', { form });
    }

    if (!linkResult.success && linkResult.reason === 'duplicate_oauth') {
      form.message = {
        type: 'error',
        text: 'OAuth account is already linked to another user',
      };
      return actionResult('failure', { form });
    }
  }

  await createSession(lucia, user.id, cookies);

  return actionResult('redirect', '/', 303);
};
