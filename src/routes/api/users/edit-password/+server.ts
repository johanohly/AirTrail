import { actionResult, setError, superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

import type { RequestHandler } from './$types';

import { db } from '$lib/db';
import { generateHash, verifyHash } from '$lib/server/utils/hash';
import { editPasswordSchema } from '$lib/zod/user';

export const POST: RequestHandler = async ({ locals, request }) => {
  const form = await superValidate(request, zod(editPasswordSchema));
  if (!form.valid) return actionResult('failure', { form });

  const user = locals.user;
  if (!user || !user.password) {
    return actionResult(
      'error',
      'You must be logged in to edit your password.',
      401,
    );
  }

  const { currentPassword, newPassword } = form.data;
  const valid = await verifyHash(user.password, currentPassword);
  if (!valid) {
    setError(form, 'currentPassword', 'Invalid password');
    return actionResult('failure', { form });
  }

  const passwordHash = await generateHash(newPassword);

  const resp = await db
    .updateTable('user')
    .set({
      password: passwordHash,
    })
    .where('id', '=', user.id)
    .executeTakeFirst();

  if (!resp.numUpdatedRows) {
    form.message = { type: 'error', text: 'Failed to update password' };
    return actionResult('failure', { form });
  }

  form.message = {
    type: 'success',
    text: 'Password updated. Please log in again',
  };
  return actionResult('success', { form });
};
