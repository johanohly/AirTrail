import { actionResult, setError, superValidate } from 'sveltekit-superforms';
import { zod4 as zod } from 'sveltekit-superforms/adapters';

import type { RequestHandler } from './$types';

import { db } from '$lib/db';
import { loadLockedAuthorizationContext } from '$lib/server/authorization/context';
import { actorCanAssignRole, lockRoles } from '$lib/server/authorization/roles';
import {
  canActOnUser,
  hasUserChangePermissions,
} from '$lib/server/authorization/users';
import { usernameExists } from '$lib/server/utils/auth';
import { adminEditUserSchema } from '$lib/zod/user';

type UpdateResult =
  | { kind: 'updated' }
  | { kind: 'unchanged' }
  | { kind: 'not_found' }
  | { kind: 'username_exists' }
  | { kind: 'forbidden' };

export const POST: RequestHandler = async ({ locals, request }) => {
  const form = await superValidate(request, zod(adminEditUserSchema));
  if (!form.valid) return actionResult('failure', { form });

  const authorization = locals.authorization;
  if (!authorization) {
    return actionResult('error', 'You must be logged in to edit users.', 401);
  }

  const { id: userId, username, displayName, roleId } = form.data;
  const outcome: UpdateResult = await db.transaction().execute(async (trx) => {
    const currentAuthorization = await loadLockedAuthorizationContext(
      authorization.userId,
      trx,
    );
    if (!currentAuthorization) return { kind: 'forbidden' };
    const target = await trx
      .selectFrom('user')
      .selectAll()
      .where('id', '=', userId)
      .forUpdate()
      .executeTakeFirst();
    if (!target) return { kind: 'not_found' };
    await lockRoles(trx, [target.roleId, roleId]);
    if (!(await canActOnUser(currentAuthorization, target, trx))) {
      return { kind: 'forbidden' };
    }

    const usernameChanged = username !== target.username;
    const displayNameChanged = displayName !== target.displayName;
    const roleChanged = roleId !== target.roleId;
    const profileChanged = usernameChanged || displayNameChanged;
    if (!profileChanged && !roleChanged) return { kind: 'unchanged' };

    if (
      !hasUserChangePermissions(currentAuthorization, {
        profile: profileChanged,
        role: roleChanged,
      })
    ) {
      return { kind: 'forbidden' };
    }
    if (
      roleChanged &&
      !(await actorCanAssignRole(currentAuthorization, roleId, trx))
    ) {
      return { kind: 'forbidden' };
    }
    if (usernameChanged && (await usernameExists(username, userId, trx))) {
      return { kind: 'username_exists' };
    }

    const update = {
      ...(usernameChanged ? { username } : {}),
      ...(displayNameChanged ? { displayName } : {}),
      ...(roleChanged
        ? { roleId, roleAssignmentSource: 'local' as const }
        : {}),
    };
    const result = await trx
      .updateTable('user')
      .set(update)
      .where('id', '=', userId)
      .executeTakeFirst();
    if (!result.numUpdatedRows) return { kind: 'not_found' };

    return { kind: 'updated' };
  });

  switch (outcome.kind) {
    case 'updated':
      form.message = { type: 'success', text: 'User updated' };
      return actionResult('success', { form });
    case 'unchanged':
      form.message = { type: 'error', text: 'No changes made' };
      return actionResult('success', { form });
    case 'not_found':
      return actionResult('error', 'User not found.', 404);
    case 'username_exists':
      setError(form, 'username', 'Username already exists');
      return actionResult('failure', { form });
    case 'forbidden':
      return actionResult('error', 'You cannot make these changes.', 403);
  }
};
