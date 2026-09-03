import type { RequestHandler } from './$types';
import { findAirline } from '$lib/server/utils/airline';
import { toAirlineDto } from '$lib/api/v1/dto';
import { authenticateRestPrincipal } from '$lib/server/api/v1/authenticate';
import { apiV1Unauthorized } from '$lib/server/api/v1/errors';
import { requireApiScope } from '$lib/server/api/v1/access';
import { apiV1Collection, handleApiV1Error } from '$lib/server/api/v1/response';
export const GET: RequestHandler = async (event) => {
  const principal = await authenticateRestPrincipal(event);
  if (!principal) return apiV1Unauthorized('reference_data.read');
  try {
    requireApiScope(principal, 'reference_data.read');
    return apiV1Collection(
      (
        (await findAirline(
          event.url.searchParams.get('query')?.trim() ?? '',
        )) ?? []
      ).map(toAirlineDto),
      { nextCursor: null },
    );
  } catch (error) {
    return handleApiV1Error(error);
  }
};
