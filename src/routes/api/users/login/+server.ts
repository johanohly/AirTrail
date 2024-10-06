import { actionResult, superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { signInSchema } from '$lib/zod/auth';
import { createSession, getUser } from '$lib/server/utils/auth';
import { verifyPassword } from '$lib/server/utils/password';
import { lucia } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies, request }) => {
  const form = await superValidate(request, zod(signInSchema));
  if (!form.valid) {
    return actionResult('failure', { form });
  }

  const { username, password } = form.data;

  const user = await getUser(username);
  if (!user || !user.password) {
    form.message = { type: 'error', text: 'Invalid username or password' };
    return actionResult('failure', { form });
  }

  const validPassword = await verifyPassword(user.password, password);
  if (!validPassword) {
    form.message = { type: 'error', text: 'Invalid username or password' };
    return actionResult('failure', { form });
  }

  await createSession(lucia, user.id, cookies);

  return actionResult('redirect', '/', 303);
};
