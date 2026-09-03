import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { updatePreferencesSchema } from '$lib/zod/user';
import { authenticateRestPrincipal } from '$lib/server/api/v1/authenticate';
import { apiV1Unauthorized } from '$lib/server/api/v1/errors';
import { requireApiScope } from '$lib/server/api/v1/access';
import { parseJsonBody } from '$lib/server/api/v1/body';
import { apiV1Data, handleApiV1Error } from '$lib/server/api/v1/response';
export const PUT: RequestHandler = async (event) => {
  const p = await authenticateRestPrincipal(event);
  if (!p) return apiV1Unauthorized('preferences.write');
  try {
    requireApiScope(p, 'preferences.write');
    const input = await parseJsonBody(event.request, updatePreferencesSchema);
    await db
      .updateTable('user')
      .set(input)
      .where('id', '=', p.user.id)
      .execute();
    return apiV1Data({ updated: true });
  } catch (e) {
    return handleApiV1Error(e);
  }
};
