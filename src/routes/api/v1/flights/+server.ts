import { flightInputSchema } from '$lib/api/v1/schemas';
import { parseJsonBody } from '$lib/server/api/v1/body';
import { parseFlightScope, parsePage } from '$lib/server/api/v1/query';
import { apiRoute } from '$lib/server/api/v1/route';
import { apiV1Collection, apiV1Data } from '$lib/server/api/v1/response';
import { createFlight, listFlights } from '$lib/server/api/v1/services/flights';

export const GET = apiRoute(
  'api-v1-list-flights',
  async ({ principal, event }) => {
    const { data, page } = await listFlights(
      principal,
      parseFlightScope(event.url.searchParams),
      parsePage(
        event.url.searchParams.get('limit'),
        event.url.searchParams.get('cursor'),
      ),
    );
    return apiV1Collection(data, page);
  },
);

export const POST = apiRoute(
  'api-v1-create-flight',
  async ({ principal, event }) => {
    const input = await parseJsonBody(event.request, flightInputSchema);
    const id = await createFlight(principal, input);
    return apiV1Data(
      { id },
      { status: 201, headers: { Location: `/api/v1/flights/${id}` } },
    );
  },
);
