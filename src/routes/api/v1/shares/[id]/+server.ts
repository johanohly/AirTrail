import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { shareInputSchema } from '$lib/api/v1/schemas';
import { authenticateRestPrincipal } from '$lib/server/api/v1/authenticate';
import {
  apiV1Unauthorized,
  ApiOperationError,
} from '$lib/server/api/v1/errors';
import { requireApiScope } from '$lib/server/api/v1/access';
import { parseJsonBody, parsePositiveId } from '$lib/server/api/v1/body';
import { apiV1Data, handleApiV1Error } from '$lib/server/api/v1/response';
export const PUT: RequestHandler = async (event) => {
  const p = await authenticateRestPrincipal(event);
  if (!p) return apiV1Unauthorized('shares.write');
  try {
    requireApiScope(p, 'shares.write');
    const id = parsePositiveId(event.params.id);
    const input = await parseJsonBody(event.request, shareInputSchema);
    const row = await db
      .updateTable('publicShare')
      .set({
        ...input,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        showTracks: input.showMap && input.showTracks,
      })
      .where('id', '=', id)
      .where('userId', '=', p.user.id)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw new ApiOperationError('not_found', 'Share not found', 404);
    return apiV1Data(row);
  } catch (e) {
    return handleApiV1Error(e);
  }
};
export const DELETE: RequestHandler = async (event) => {
  const p = await authenticateRestPrincipal(event);
  if (!p) return apiV1Unauthorized('shares.write');
  try {
    requireApiScope(p, 'shares.write');
    const deleted = await db
      .deleteFrom('publicShare')
      .where('id', '=', parsePositiveId(event.params.id))
      .where('userId', '=', p.user.id)
      .executeTakeFirst();
    if (!deleted.numDeletedRows)
      throw new ApiOperationError('not_found', 'Share not found', 404);
    return new Response(null, { status: 204 });
  } catch (e) {
    return handleApiV1Error(e);
  }
};
