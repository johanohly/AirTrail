import { actionResult, superValidate } from 'sveltekit-superforms';
import { zod4 as zod } from 'sveltekit-superforms/adapters';

import type { RequestHandler } from './$types';

import { db } from '$lib/db';
import { isPublicDemo } from '$lib/server/demo/mode';
import { hashArgon2 } from '$lib/server/utils/hash';
import { setPasswordSchema } from '$lib/zod/user';

export const POST: RequestHandler = async ({ locals, request }) => {
  const form = await superValidate(request, zod(setPasswordSchema));
  if (!form.valid) return actionResult('failure', { form });
  if (isPublicDemo()) {
    return actionResult('error', 'Not available in the demo.', 403);
  }

  const user = locals.user;
  if (!user) {
    return actionResult(
      'error',
      'You must be logged in to set your password.',
      401,
    );
  }

  // Only ever fills an empty password. Changing one must prove the current
  // password, which is what `edit-password` is for.
  const passwordHash = await hashArgon2(form.data.newPassword);
  const resp = await db
    .updateTable('user')
    .set({ password: passwordHash })
    .where('id', '=', user.id)
    .where('password', 'is', null)
    .executeTakeFirst();

  if (!resp.numUpdatedRows) {
    form.message = { type: 'error', text: 'You already have a password' };
    return actionResult('failure', { form });
  }

  form.message = { type: 'success', text: 'Password set' };
  return actionResult('success', { form });
};
