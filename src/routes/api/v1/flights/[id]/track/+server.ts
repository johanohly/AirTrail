import type { RequestHandler } from './$types';
import { flightTrackInputSchema } from '$lib/track/schema';
import { authenticateRestPrincipal } from '$lib/server/api/v1/authenticate';
import { apiV1Unauthorized } from '$lib/server/api/v1/errors';
import { parseJsonBody, parsePositiveId } from '$lib/server/api/v1/body';
import { apiV1Data, handleApiV1Error } from '$lib/server/api/v1/response';
import {
  deleteApiFlightTrack,
  getApiFlightTrack,
  setApiFlightTrack,
} from '$lib/server/api/v1/track';

export const GET: RequestHandler = async ({ request, params }) => {
  const principal = await authenticateRestPrincipal({
    request,
    url: new URL(request.url),
  });
  if (!principal) return apiV1Unauthorized('tracks.read');
  try {
    return apiV1Data(
      await getApiFlightTrack(principal, parsePositiveId(params.id)),
    );
  } catch (error) {
    return handleApiV1Error(error);
  }
};

export const PUT: RequestHandler = async ({ request, params }) => {
  const principal = await authenticateRestPrincipal({
    request,
    url: new URL(request.url),
  });
  if (!principal) return apiV1Unauthorized('tracks.write');
  try {
    return apiV1Data(
      await setApiFlightTrack(
        principal,
        parsePositiveId(params.id),
        await parseJsonBody(request, flightTrackInputSchema),
      ),
    );
  } catch (error) {
    return handleApiV1Error(error);
  }
};

export const DELETE: RequestHandler = async ({ request, params }) => {
  const principal = await authenticateRestPrincipal({
    request,
    url: new URL(request.url),
  });
  if (!principal) return apiV1Unauthorized('tracks.write');
  try {
    await deleteApiFlightTrack(principal, parsePositiveId(params.id));
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiV1Error(error);
  }
};
