import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { shareInputSchema } from '$lib/api/v1/schemas';
import { authenticateRestPrincipal } from '$lib/server/api/v1/authenticate';
import {
  apiV1Unauthorized,
  ApiOperationError,
} from '$lib/server/api/v1/errors';
import { requireApiScope } from '$lib/server/api/v1/access';
import { parseJsonBody } from '$lib/server/api/v1/body';
import { apiV1Data, handleApiV1Error } from '$lib/server/api/v1/response';

export const GET: RequestHandler = async (event) => {
  const principal = await authenticateRestPrincipal(event);
  if (!principal) return apiV1Unauthorized('shares.read');
  try {
    requireApiScope(principal, 'shares.read');
    return apiV1Data(
      await db
        .selectFrom('publicShare')
        .selectAll()
        .where('userId', '=', principal.user.id)
        .orderBy('createdAt', 'desc')
        .execute(),
    );
  } catch (error) {
    return handleApiV1Error(error);
  }
};
export const POST: RequestHandler = async (event) => {
  const principal = await authenticateRestPrincipal(event);
  if (!principal) return apiV1Unauthorized('shares.write');
  try {
    requireApiScope(principal, 'shares.write');
    const input = await parseJsonBody(event.request, shareInputSchema);
    const exists = await db
      .selectFrom('publicShare')
      .select('id')
      .where('slug', '=', input.slug)
      .executeTakeFirst();
    if (exists)
      throw new ApiOperationError('conflict', 'Share slug already exists', 409);
    const row = await db
      .insertInto('publicShare')
      .values({
        ...input,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        showTracks: input.showMap && input.showTracks,
        userId: principal.user.id,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return apiV1Data(row, {
      status: 201,
      headers: { Location: `/api/v1/shares/${row.id}` },
    });
  } catch (error) {
    return handleApiV1Error(error);
  }
};
