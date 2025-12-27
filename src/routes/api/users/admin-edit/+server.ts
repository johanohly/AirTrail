import { actionResult, setError, superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

import type { RequestHandler } from './$types';

import { db } from '$lib/db';
import { usernameExists } from '$lib/server/utils/auth';
import { adminEditUserSchema } from '$lib/zod/user';

export const POST: RequestHandler = async ({ locals, request }) => {
  const form = await superValidate(request, zod(adminEditUserSchema));
  if (!form.valid) return actionResult('failure', { form });

  const user = locals.user;
  if (!user) {
    return actionResult('error', 'You must be logged in to edit users.', 401);
  }
  if (user.role === 'user') {
    return actionResult('error', 'You must be an admin to edit users.', 403);
  }

  const { id: userId, username, displayName, unit, role } = form.data;

  const targetUser = await db
    .selectFrom('user')
    .selectAll()
    .where('id', '=', userId)
    .executeTakeFirst();

  if (!targetUser) {
    return actionResult('error', 'User not found.', 404);
  }

  if (targetUser.role === 'owner') {
    return actionResult('error', 'Cannot edit the owner.', 403);
  }

  if (targetUser.role === 'admin' && user.role === 'admin') {
    return actionResult('error', 'Admins cannot edit other admins.', 403);
  }

  const updatedFields: Record<string, string> = {};

  if (username !== targetUser.username) {
    updatedFields.username = username;
  }
  if (displayName !== targetUser.displayName) {
    updatedFields.displayName = displayName;
  }
  if (unit !== targetUser.unit) {
    updatedFields.unit = unit;
  }
  if (role !== targetUser.role) {
    updatedFields.role = role;
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
    .where('id', '=', userId)
    .executeTakeFirst();
  if (!resp.numUpdatedRows) {
    form.message = { type: 'error', text: 'Failed to edit user' };
    return actionResult('failure', { form });
  }

  form.message = { type: 'success', text: 'User updated' };

  return actionResult('success', { form });
};
