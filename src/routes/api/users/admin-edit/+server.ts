import { actionResult, setError, superValidate } from 'sveltekit-superforms';
import { zod4 as zod } from 'sveltekit-superforms/adapters';

import type { RequestHandler } from './$types';

import { db } from '$lib/db';
import { actorCanAssignRole } from '$lib/server/authorization/roles';
import { canManageUser } from '$lib/server/authorization/users';
import { writeAuthorizationAudit } from '$lib/server/authorization/audit';
import { usernameExists } from '$lib/server/utils/auth';
import { adminEditUserSchema } from '$lib/zod/user';

const getChangedFields = <T extends Record<string, unknown>>(
  newValues: T,
  currentValues: Record<string, unknown>,
): Partial<T> => {
  const keys = Object.keys(newValues) as (keyof T)[];
  return keys.reduce<Partial<T>>((changes, key) => {
    if (newValues[key] !== currentValues[key as string]) {
      changes[key] = newValues[key];
    }
    return changes;
  }, {});
};

export const POST: RequestHandler = async ({ locals, request }) => {
  const form = await superValidate(request, zod(adminEditUserSchema));
  if (!form.valid) return actionResult('failure', { form });

  const { id: userId, username, displayName, roleId } = form.data;

  if (!locals.authorization) {
    return actionResult('error', 'You must be logged in to edit users.', 401);
  }

  const targetUser = await db
    .selectFrom('user')
    .selectAll()
    .where('id', '=', userId)
    .executeTakeFirst();

  if (!targetUser) {
    return actionResult('error', 'User not found.', 404);
  }

  if (!(await canManageUser(locals.authorization, userId, 'users.update'))) {
    return actionResult('error', 'You cannot edit this user.', 403);
  }
  if (!(await actorCanAssignRole(locals.authorization, roleId))) {
    return actionResult('error', 'You cannot assign this role.', 403);
  }

  const updatedFields = getChangedFields(
    { username, displayName, roleId },
    targetUser,
  );
  const update = {
    ...updatedFields,
    ...(updatedFields.roleId ? { roleAssignmentSource: 'local' as const } : {}),
  };

  if (Object.keys(update).length === 0) {
    form.message = { type: 'error', text: 'No changes made' };
    return actionResult('success', { form });
  }

  if (updatedFields.username) {
    const exists = await usernameExists(updatedFields.username, userId);
    if (exists) {
      setError(form, 'username', 'Username already exists');
      return actionResult('failure', { form });
    }
  }

  const resp = await db.transaction().execute(async (trx) => {
    const result = await trx
      .updateTable('user')
      .set(update)
      .where('id', '=', userId)
      .executeTakeFirst();
    await writeAuthorizationAudit(
      {
        actorUserId: locals.authorization!.userId,
        action: 'user.updated',
        targetType: 'user',
        targetId: userId,
        before: {
          username: targetUser.username,
          displayName: targetUser.displayName,
          roleId: targetUser.roleId,
          roleAssignmentSource: targetUser.roleAssignmentSource,
        },
        after: update,
      },
      trx,
    );
    return result;
  });

  if (!resp.numUpdatedRows) {
    form.message = { type: 'error', text: 'Failed to edit user' };
    return actionResult('failure', { form });
  }

  form.message = { type: 'success', text: 'User updated' };
  return actionResult('success', { form });
};
