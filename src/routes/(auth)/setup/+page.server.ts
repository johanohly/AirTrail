import type { Actions, PageServerLoad } from './$types';
import { trpcServer } from '$lib/server/server';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { signUpSchema } from '$lib/zod/auth';
import { fail, redirect } from '@sveltejs/kit';
import {
  createSession,
  createUser,
  usernameExists,
} from '$lib/server/utils/auth';
import { generateId } from 'lucia';
import { Argon2id } from 'oslo/password';
import { lucia } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
  await trpcServer.user.isSetup.ssr(event);

  const form = await superValidate(zod(signUpSchema));
  return { form };
};

export const actions: Actions = {
  default: async (event) => {
    const form = await superValidate(event, zod(signUpSchema));
    if (!form.valid) {
      return fail(400, { form });
    }

    const { username, password, displayName } = form.data;
    const exists = await usernameExists(username);
    if (exists) {
      return setError(form, 'username', 'Username already exists');
    }

    const userId = generateId(15);
    const hashedPassword = await new Argon2id().hash(password);

    // Always create the first user as an admin
    const success = await createUser(
      userId,
      username,
      hashedPassword,
      displayName,
      'admin',
    );

    if (!success) {
      return message(form, 'Failed to create user');
    }

    await createSession(lucia, userId, event.cookies);

    return redirect(302, '/');
  },
};
