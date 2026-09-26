import { flightInputSchema } from '$lib/api/v1/schemas';
import { parseJsonBody } from '$lib/server/api/v1/body';
import { parsePositiveId } from '$lib/server/api/v1/params';
import { apiRoute } from '$lib/server/api/v1/route';
import { apiV1Data } from '$lib/server/api/v1/response';
import {
  deleteFlight,
  getFlight,
  updateFlight,
} from '$lib/server/api/v1/services/flights';

export const GET = apiRoute('api-v1-get-flight', async ({ principal, event }) =>
  apiV1Data(await getFlight(principal, parsePositiveId(event.params.id!))),
);

export const PUT = apiRoute(
  'api-v1-update-flight',
  async ({ principal, event }) => {
    const id = parsePositiveId(event.params.id!);
    const input = await parseJsonBody(event.request, flightInputSchema);
    return apiV1Data(await updateFlight(principal, id, input));
  },
);

export const DELETE = apiRoute(
  'api-v1-delete-flight',
  async ({ principal, event }) => {
    await deleteFlight(principal, parsePositiveId(event.params.id!));
    return new Response(null, { status: 204 });
  },
);
