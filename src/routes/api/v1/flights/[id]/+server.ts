import { flightInputSchema } from '$lib/api/v1/schemas';
import { parseJsonBody, parsePositiveId } from '$lib/server/api/v1/body';
import {
  deleteApiFlight,
  updateApiFlight,
} from '$lib/server/api/v1/flight-write';
import { apiRoute } from '$lib/server/api/v1/route';
import { apiV1Data } from '$lib/server/api/v1/response';
import { getFlightById } from '$lib/server/api/v1/services/flights';

export const GET = apiRoute('flight.read.own', async ({ principal, event }) =>
  apiV1Data(await getFlightById(principal, parsePositiveId(event.params.id!))),
);

export const PUT = apiRoute(
  'flight.update.own',
  async ({ principal, event }) => {
    const id = parsePositiveId(event.params.id!);
    const input = await parseJsonBody(event.request, flightInputSchema);
    await updateApiFlight(principal, id, input);
    return apiV1Data(await getFlightById(principal, id));
  },
);

export const DELETE = apiRoute(
  'flight.delete.own',
  async ({ principal, event }) => {
    await deleteApiFlight(principal, parsePositiveId(event.params.id!));
    return new Response(null, { status: 204 });
  },
);
