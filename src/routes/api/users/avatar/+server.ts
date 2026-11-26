import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

import { db } from '$lib/db';
import { loadLockedAuthorizationContext } from '$lib/server/authorization/context';
import {
  canActOnUser,
  hasUserChangePermissions,
} from '$lib/server/authorization/users';
import { isPublicDemo } from '$lib/server/demo/mode';
import {
  ALLOWED_AVATAR_TYPES,
  AvatarError,
  clearAvatar,
  isAvatarManagedByOAuth,
  MAX_AVATAR_INPUT_SIZE,
  processAvatar,
  setAvatar,
} from '$lib/server/utils/avatar';
import { appConfig } from '$lib/server/utils/config';

type Locals = App.Locals;
type Target = { id: string; oauthId: string | null; self: boolean };

const syncPictureEnabled = async () =>
  (await appConfig.get())?.oauth.syncPicture ?? false;

const fail = (error: string, status: number) => json({ error }, { status });

/**
 * Resolves whose picture a request changes. With no `userId`, or the caller's
 * own id, it is the caller's. Another user's picture needs `users.update` and
 * the same "can act on this user" check as editing their profile.
 */
const resolveTarget = async (
  locals: Locals,
  userId: string | null,
): Promise<Target | Response> => {
  const user = locals.user;
  const authorization = locals.authorization;
  if (!user || !authorization) return fail('Not logged in', 401);
  if (isPublicDemo()) {
    return fail('Pictures cannot be changed in the demo', 403);
  }

  if (!userId || userId === user.id) {
    return { id: user.id, oauthId: user.oauthId, self: true };
  }

  const outcome = await db.transaction().execute(async (trx) => {
    const current = await loadLockedAuthorizationContext(
      authorization.userId,
      trx,
    );
    if (
      !current ||
      !hasUserChangePermissions(current, { profile: true, role: false })
    ) {
      return 'forbidden' as const;
    }
    const target = await trx
      .selectFrom('user')
      .select(['id', 'isOwner', 'roleId', 'oauthId'])
      .where('id', '=', userId)
      .forUpdate()
      .executeTakeFirst();
    if (!target) return 'not_found' as const;
    if (!(await canActOnUser(current, target, trx))) {
      return 'forbidden' as const;
    }
    return target;
  });

  if (outcome === 'not_found') return fail('User not found', 404);
  if (outcome === 'forbidden') return fail('Unauthorized', 403);
  return { id: outcome.id, oauthId: outcome.oauthId, self: false };
};

const managedError = (target: Target) =>
  fail(
    target.self
      ? 'Your picture is managed by your identity provider'
      : "This user's picture is managed by their identity provider",
    403,
  );

/**
 * Sets a picture from a multipart `file`. An optional `userId` field sets
 * another user's picture.
 */
export const POST: RequestHandler = async ({ locals, request }) => {
  const formData = await request.formData();
  const userId = formData.get('userId');
  if (userId !== null && typeof userId !== 'string') {
    return fail('Invalid userId', 400);
  }

  const target = await resolveTarget(locals, userId);
  if (target instanceof Response) return target;
  if (isAvatarManagedByOAuth(target, await syncPictureEnabled())) {
    return managedError(target);
  }

  const file = formData.get('file');
  if (!(file instanceof File)) return fail('Missing file', 400);
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    return fail('Use a PNG, JPEG, WebP, GIF or AVIF image', 400);
  }
  if (file.size > MAX_AVATAR_INPUT_SIZE) {
    return fail('Image is too large (max 5 MB)', 400);
  }

  try {
    const data = await processAvatar(new Uint8Array(await file.arrayBuffer()));
    const avatarHash = await setAvatar(target.id, data, 'upload');
    return json({ avatarHash });
  } catch (err) {
    if (err instanceof AvatarError) return fail(err.message, 400);
    throw err;
  }
};

/**
 * Removes a picture. Without a body it removes the caller's own; with
 * `{ userId }` it removes another user's.
 */
export const DELETE: RequestHandler = async ({ locals, request }) => {
  let userId: string | null = null;
  const body = await request.text();
  if (body) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return fail('Invalid request body', 400);
    }
    const value = (parsed as { userId?: unknown } | null)?.userId;
    if (value !== undefined && typeof value !== 'string') {
      return fail('Invalid userId', 400);
    }
    userId = value ?? null;
  }

  const target = await resolveTarget(locals, userId);
  if (target instanceof Response) return target;
  // Admins may still clear a synced picture, for example an inappropriate
  // one; the next login copies the provider's picture again.
  if (
    target.self &&
    isAvatarManagedByOAuth(target, await syncPictureEnabled())
  ) {
    return managedError(target);
  }

  await clearAvatar(target.id);
  return json({ success: true });
};
