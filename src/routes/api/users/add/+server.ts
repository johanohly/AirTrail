import { generateId } from 'lucia';
import { actionResult, setError, superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

import type { RequestHandler } from './$types';

import { createUser, usernameExists } from '$lib/server/utils/auth';
import { hashArgon2 } from '$lib/server/utils/hash';
import { addUserSchema } from '$lib/zod/user';

export const POST: RequestHandler = async ({ locals, request }) => {
  const form = await superValidate(request, zod(addUserSchema));
  if (!form.valid) return actionResult('failure', { form });

  const user = locals.user;
  if (!user) {
    return actionResult('error', 'You must be logged in to create users.', 401);
  }
  if (user.role === 'user') {
    return actionResult('error', 'You must be an admin to create users.', 403);
  }

  const { username, password, displayName, unit, role } = form.data;

  const exists = await usernameExists(username);
  if (exists) {
    setError(form, 'username', 'Username already exists');
    return actionResult('failure', { form });
  }

  const userId = generateId(15);
  const passwordHash = await hashArgon2(password);

  const success = await createUser(
    userId,
    username,
    passwordHash,
    displayName,
    unit,
    role,
  );
  if (!success) {
    form.message = { type: 'error', text: 'Failed to create user' };
    return actionResult('failure', { form });
  }

  form.message = { type: 'success', text: 'User created' };
  return actionResult('success', { form });
};
