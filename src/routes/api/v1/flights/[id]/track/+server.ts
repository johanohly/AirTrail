import { flightTrackInputSchema } from '$lib/track/schema';
import { parseJsonBody, parsePositiveId } from '$lib/server/api/v1/body';
import { apiRoute } from '$lib/server/api/v1/route';
import { apiV1Data } from '$lib/server/api/v1/response';
import {
  deleteApiFlightTrack,
  getApiFlightTrack,
  setApiFlightTrack,
} from '$lib/server/api/v1/track';

export const GET = apiRoute('tracks.read', async ({ principal, event }) =>
  apiV1Data(
    await getApiFlightTrack(principal, parsePositiveId(event.params.id!)),
  ),
);

export const PUT = apiRoute('tracks.write', async ({ principal, event }) => {
  const track = await parseJsonBody(event.request, flightTrackInputSchema);
  return apiV1Data(
    await setApiFlightTrack(
      principal,
      parsePositiveId(event.params.id!),
      track,
    ),
  );
});

export const DELETE = apiRoute('tracks.write', async ({ principal, event }) => {
  await deleteApiFlightTrack(principal, parsePositiveId(event.params.id!));
  return new Response(null, { status: 204 });
});
