import { zod } from 'sveltekit-superforms/adapters';
import type { RequestHandler } from './$types';
import { actionResult, setError, superValidate } from 'sveltekit-superforms';
import { editPasswordSchema } from '$lib/zod/user';
import { hashPassword, verifyPassword } from '$lib/server/utils/password';
import { db } from '$lib/db';

export const POST: RequestHandler = async ({ locals, request }) => {
  const form = await superValidate(request, zod(editPasswordSchema));
  if (!form.valid) return actionResult('failure', { form });

  const user = locals.user;
  if (!user) {
    return actionResult(
      'error',
      'You must be logged in to edit your password.',
      401,
    );
  }

  const { currentPassword, newPassword } = form.data;
  const valid = await verifyPassword(user.password, currentPassword);
  if (!valid) {
    setError(form, 'currentPassword', 'Invalid password');
    return actionResult('failure', { form });
  }

  const passwordHash = await hashPassword(newPassword);

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
