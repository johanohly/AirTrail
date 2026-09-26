import { parseFlightScope } from '$lib/server/api/v1/query';
import { apiRoute } from '$lib/server/api/v1/route';
import { apiV1Data } from '$lib/server/api/v1/response';
import { getFlightStats } from '$lib/server/api/v1/services/flights';

export const GET = apiRoute('api-v1-get-stats', async ({ principal, event }) =>
  apiV1Data(
    await getFlightStats(principal, parseFlightScope(event.url.searchParams)),
  ),
);
