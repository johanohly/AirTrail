import { actionResult, superValidate } from 'sveltekit-superforms';
import { zod4 as zod } from 'sveltekit-superforms/adapters';

import type { RequestHandler } from './$types';

import { lucia } from '$lib/server/auth';
import { postLoginTarget } from '$lib/server/oauth/resume';
import {
  clientIdentity,
  RATE_LIMITS,
  rateLimiter,
} from '$lib/server/security/rate-limit';
import { createSession, getUserWithPassword } from '$lib/server/utils/auth';
import { verifyArgon2 } from '$lib/server/utils/hash';
import { linkOAuthAccountWithToken } from '$lib/server/utils/oauth-link-token';
import { signInSchema } from '$lib/zod/auth';

export const POST: RequestHandler = async ({
  cookies,
  request,
  getClientAddress,
}) => {
  const form = await superValidate(request, zod(signInSchema));

  /*
   * Throttled before the password is checked, which is the expensive step, and
   * keyed by address and by address-plus-username so that neither one address
   * nor one account can be hammered. Reported as an ordinary form failure so
   * the login page shows it like any other message.
   */
  const identity = clientIdentity(getClientAddress);
  const attempts = [
    rateLimiter.check(RATE_LIMITS.loginAddress, identity),
    rateLimiter.check(RATE_LIMITS.loginAccount, form.data.username),
  ];
  const blocked = attempts.find((attempt) => !attempt.allowed);
  if (blocked?.allowed === false) {
    form.message = {
      type: 'error',
      text: `Too many login attempts. Try again in ${blocked.retryAfterSeconds} seconds.`,
    };
    return actionResult('failure', { form });
  }

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

  return actionResult('redirect', postLoginTarget(cookies), 303);
};
