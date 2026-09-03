import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { authenticateRestPrincipal } from '$lib/server/api/v1/authenticate';
import { apiV1Unauthorized } from '$lib/server/api/v1/errors';
import { requireApiScope } from '$lib/server/api/v1/access';
import { apiV1Data, handleApiV1Error } from '$lib/server/api/v1/response';
export const GET: RequestHandler = async (event) => {
  const p = await authenticateRestPrincipal(event);
  if (!p) return apiV1Unauthorized('profile.read');
  try {
    requireApiScope(p, 'profile.read');
    return apiV1Data(
      await db
        .selectFrom('customFieldDefinition')
        .selectAll()
        .where('active', '=', true)
        .orderBy('entityType')
        .orderBy('order')
        .execute(),
    );
  } catch (e) {
    return handleApiV1Error(e);
  }
};
