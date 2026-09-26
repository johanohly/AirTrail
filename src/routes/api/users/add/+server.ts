import { generateId } from 'lucia';
import { actionResult, setError, superValidate } from 'sveltekit-superforms';
import { zod4 as zod } from 'sveltekit-superforms/adapters';

import type { RequestHandler } from './$types';

import { db } from '$lib/db';
import { hasPermission } from '$lib/server/authorization/authorize';
import { loadLockedAuthorizationContext } from '$lib/server/authorization/context';
import { actorCanAssignRole, lockRoles } from '$lib/server/authorization/roles';
import { createUser, usernameExists } from '$lib/server/utils/auth';
import { hashArgon2 } from '$lib/server/utils/hash';
import { addUserSchema } from '$lib/zod/user';

export const POST: RequestHandler = async ({ locals, request }) => {
  const form = await superValidate(request, zod(addUserSchema));
  if (!form.valid) return actionResult('failure', { form });

  const authorization = locals.authorization;
  if (!locals.user || !authorization) {
    return actionResult('error', 'You must be logged in to create users.', 401);
  }
  if (!hasPermission(authorization, 'users.create')) {
    return actionResult(
      'error',
      'You do not have permission to create users.',
      403,
    );
  }

  const { username, password, displayName, roleId } = form.data;
  const userId = generateId(15);
  const passwordHash = await hashArgon2(password);
  const outcome = await db.transaction().execute(async (trx) => {
    const currentAuthorization = await loadLockedAuthorizationContext(
      authorization.userId,
      trx,
    );
    if (
      !currentAuthorization ||
      !hasPermission(currentAuthorization, 'users.create')
    ) {
      return 'forbidden';
    }
    await lockRoles(trx, [roleId]);
    if (!(await actorCanAssignRole(currentAuthorization, roleId, trx))) {
      return 'forbidden';
    }
    if (await usernameExists(username, undefined, trx)) {
      return 'username_exists';
    }
    const success = await createUser({
      id: userId,
      username,
      password: passwordHash,
      displayName,
      roleId,
      connection: trx,
    });
    if (!success) return 'failed';
    return 'created';
  });

  if (outcome === 'username_exists') {
    setError(form, 'username', 'Username already exists');
    return actionResult('failure', { form });
  }
  if (outcome === 'forbidden') {
    return actionResult('error', 'You cannot assign this role.', 403);
  }
  if (outcome === 'failed') {
    form.message = { type: 'error', text: 'Failed to create user' };
    return actionResult('failure', { form });
  }

  form.message = { type: 'success', text: 'User created' };
  return actionResult('success', { form });
};
