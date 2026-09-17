import { apiRoute } from '$lib/server/api/v1/route';
import { apiV1Collection } from '$lib/server/api/v1/response';
import { searchAirports } from '$lib/server/api/v1/services/reference';

export const GET = apiRoute(
  'reference_data.read',
  async ({ principal, event }) =>
    apiV1Collection(
      await searchAirports(
        principal,
        event.url.searchParams.get('query')?.trim() ?? '',
      ),
      { nextCursor: null },
    ),
);
