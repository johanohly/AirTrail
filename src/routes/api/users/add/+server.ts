import { generateId } from 'lucia';
import { actionResult, setError, superValidate } from 'sveltekit-superforms';
import { zod4 as zod } from 'sveltekit-superforms/adapters';

import type { RequestHandler } from './$types';

import { hasPermission } from '$lib/server/authorization/authorize';
import { actorCanAssignRole } from '$lib/server/authorization/roles';
import { writeAuthorizationAudit } from '$lib/server/authorization/audit';
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
  if (!(await actorCanAssignRole(authorization, roleId))) {
    return actionResult('error', 'You cannot assign this role.', 403);
  }

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
    roleId,
  );
  if (!success) {
    form.message = { type: 'error', text: 'Failed to create user' };
    return actionResult('failure', { form });
  }

  await writeAuthorizationAudit({
    actorUserId: authorization.userId,
    action: 'user.created',
    targetType: 'user',
    targetId: userId,
    after: { username, displayName, roleId, roleAssignmentSource: 'local' },
  });

  form.message = { type: 'success', text: 'User created' };
  return actionResult('success', { form });
};
