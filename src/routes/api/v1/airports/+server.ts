import type { RequestHandler } from './$types';
import { findAirports } from '$lib/server/utils/airport';
import { toAirportDto } from '$lib/api/v1/dto';
import { authenticateRestPrincipal } from '$lib/server/api/v1/authenticate';
import { apiV1Unauthorized } from '$lib/server/api/v1/errors';
import { requireApiScope } from '$lib/server/api/v1/access';
import { apiV1Collection, handleApiV1Error } from '$lib/server/api/v1/response';

export const GET: RequestHandler = async (event) => {
  const principal = await authenticateRestPrincipal(event);
  if (!principal) return apiV1Unauthorized('reference_data.read');
  try {
    requireApiScope(principal, 'reference_data.read');
    const query = event.url.searchParams.get('query')?.trim() ?? '';
    return apiV1Collection((await findAirports(query)).map(toAirportDto), {
      nextCursor: null,
    });
  } catch (error) {
    return handleApiV1Error(error);
  }
};
