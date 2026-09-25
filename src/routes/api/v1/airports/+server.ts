import { apiRoute } from '$lib/server/api/v1/route';
import { apiV1Collection } from '$lib/server/api/v1/response';
import { searchAirports } from '$lib/server/api/v1/services/reference';

export const GET = apiRoute('api-v1-search-airports', async ({ event }) =>
  apiV1Collection(
    await searchAirports(event.url.searchParams.get('query')?.trim() ?? ''),
    { nextCursor: null },
  ),
);
