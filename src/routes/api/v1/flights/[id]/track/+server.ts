import { flightTrackInputSchema } from '$lib/track/schema';
import { parseJsonBody } from '$lib/server/api/v1/body';
import { parsePositiveId } from '$lib/server/api/v1/params';
import { apiRoute } from '$lib/server/api/v1/route';
import { apiV1Data } from '$lib/server/api/v1/response';
import {
  deleteFlightTrack,
  getFlightTrack,
  setFlightTrack,
} from '$lib/server/api/v1/services/tracks';

export const GET = apiRoute(
  'api-v1-get-flight-track',
  async ({ principal, event }) =>
    apiV1Data(
      await getFlightTrack(principal, parsePositiveId(event.params.id!)),
    ),
);

export const PUT = apiRoute(
  'api-v1-set-flight-track',
  async ({ principal, event }) => {
    const track = await parseJsonBody(event.request, flightTrackInputSchema);
    return apiV1Data(
      await setFlightTrack(principal, parsePositiveId(event.params.id!), track),
    );
  },
);

export const DELETE = apiRoute(
  'api-v1-delete-flight-track',
  async ({ principal, event }) => {
    await deleteFlightTrack(principal, parsePositiveId(event.params.id!));
    return new Response(null, { status: 204 });
  },
);
