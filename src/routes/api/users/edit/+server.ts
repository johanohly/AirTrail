import { actionResult, setError, superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

import type { RequestHandler } from './$types';

import { db } from '$lib/db';
import { usernameExists } from '$lib/server/utils/auth';
import { editUserSchema } from '$lib/zod/user';

export const POST: RequestHandler = async ({ locals, request }) => {
  const form = await superValidate(request, zod(editUserSchema));
  if (!form.valid) return actionResult('failure', { form });

  const user = locals.user;
  if (!user) {
    return actionResult('error', 'You must be logged in to create users.', 401);
  }

  const { username, displayName, unit } = form.data;

  const updatedFields: Record<string, any> = {};

  if (username !== user.username) {
    updatedFields.username = username;
  }
  if (displayName !== user.displayName) {
    updatedFields.displayName = displayName;
  }
  if (unit !== user.unit) {
    updatedFields.unit = unit;
  }

  if (Object.keys(updatedFields).length === 0) {
    form.message = { type: 'error', text: 'No changes made' };
    return actionResult('success', { form });
  }

  if (updatedFields.username) {
    const exists = await usernameExists(updatedFields.username);
    if (exists) {
      setError(form, 'username', 'Username already exists');
      return actionResult('failure', { form });
    }
  }

  const resp = await db
    .updateTable('user')
    .set(updatedFields)
    .where('id', '=', user.id)
    .executeTakeFirst();
  if (!resp.numUpdatedRows) {
    form.message = { type: 'error', text: 'Failed to edit your information' };
    return actionResult('failure', { form });
  }

  form.message = { type: 'success', text: 'Information updated' };

  return actionResult('success', { form });
};
