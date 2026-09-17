import { flightInputSchema } from '$lib/api/v1/schemas';
import { parseFlightScopeSearchParams } from '$lib/flight-scope';
import { parseJsonBody } from '$lib/server/api/v1/body';
import { createApiFlight } from '$lib/server/api/v1/flight-write';
import { apiRoute } from '$lib/server/api/v1/route';
import { apiV1Collection, apiV1Data } from '$lib/server/api/v1/response';
import { listFlights } from '$lib/server/api/v1/services/flights';

export const GET = apiRoute('flight.read.own', async ({ principal, event }) => {
  const { data, nextCursor } = await listFlights(
    principal,
    parseFlightScopeSearchParams(event.url.searchParams),
    {
      limit: event.url.searchParams.get('limit'),
      cursor: event.url.searchParams.get('cursor'),
    },
  );
  return apiV1Collection(data, { nextCursor });
});

export const POST = apiRoute(
  'flight.create.own',
  async ({ principal, event }) => {
    const input = await parseJsonBody(event.request, flightInputSchema);
    const id = await createApiFlight(principal, input);
    return apiV1Data(
      { id },
      { status: 201, headers: { Location: `/api/v1/flights/${id}` } },
    );
  },
);
