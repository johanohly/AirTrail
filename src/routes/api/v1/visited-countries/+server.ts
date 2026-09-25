import { visitedCountryInputSchema } from '$lib/api/v1/schemas';
import { parseJsonBody } from '$lib/server/api/v1/body';
import { apiRoute } from '$lib/server/api/v1/route';
import { apiV1Data } from '$lib/server/api/v1/response';
import {
  listVisitedCountries,
  removeVisitedCountry,
  setVisitedCountry,
} from '$lib/server/api/v1/services/personal';

export const GET = apiRoute(
  'api-v1-list-visited-countries',
  async ({ principal }) => apiV1Data(await listVisitedCountries(principal)),
);

export const PUT = apiRoute(
  'api-v1-set-visited-country',
  async ({ principal, event }) => {
    const input = await parseJsonBody(event.request, visitedCountryInputSchema);
    return apiV1Data(await setVisitedCountry(principal, input));
  },
);

export const DELETE = apiRoute(
  'api-v1-remove-visited-country',
  async ({ principal, event }) => {
    await removeVisitedCountry(principal, event.url.searchParams.get('code'));
    return new Response(null, { status: 204 });
  },
);
