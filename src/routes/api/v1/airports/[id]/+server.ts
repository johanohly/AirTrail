import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { toAirportDto } from '$lib/api/v1/dto';
import { authenticateRestPrincipal } from '$lib/server/api/v1/authenticate';
import { apiV1Error, apiV1Unauthorized } from '$lib/server/api/v1/errors';
import { parsePositiveId } from '$lib/server/api/v1/body';
import { requireApiScope } from '$lib/server/api/v1/access';
import { apiV1Data, handleApiV1Error } from '$lib/server/api/v1/response';
export const GET: RequestHandler = async (event) => {
  const principal = await authenticateRestPrincipal(event);
  if (!principal) return apiV1Unauthorized('reference_data.read');
  try {
    requireApiScope(principal, 'reference_data.read');
    const row = await db
      .selectFrom('airport')
      .selectAll()
      .where('id', '=', parsePositiveId(event.params.id))
      .executeTakeFirst();
    return row
      ? apiV1Data(toAirportDto(row))
      : apiV1Error('not_found', 'Airport not found', 404);
  } catch (error) {
    return handleApiV1Error(error);
  }
};
