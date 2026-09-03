import type { RequestHandler } from './$types';

import { toFlightDto } from '$lib/api/v1/dto';
import { flightInputSchema } from '$lib/api/v1/schemas';
import { canAccessFlight } from '$lib/server/authorization/flight';
import { apiV1Error, apiV1Unauthorized } from '$lib/server/api/v1/errors';
import { principalHasScope } from '$lib/server/api/v1/principal';
import { getFlight } from '$lib/server/utils/flight';
import { isFlightParticipant } from '$lib/server/authorization/flight';
import { parseJsonBody, parsePositiveId } from '$lib/server/api/v1/body';
import { apiV1Data, handleApiV1Error } from '$lib/server/api/v1/response';
import {
  deleteApiFlight,
  updateApiFlight,
} from '$lib/server/api/v1/flight-write';
import { authenticateRestPrincipal } from '$lib/server/api/v1/authenticate';

const parseId = (value: string) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

export const GET: RequestHandler = async ({ request, params }) => {
  const principal = await authenticateRestPrincipal({
    request,
    url: new URL(request.url),
  });
  if (!principal) return apiV1Unauthorized('flight.read.own');
  const id = parseId(params.id);
  if (!id)
    return apiV1Error(
      'bad_request',
      'Flight id must be a positive integer',
      400,
    );

  const flight = await getFlight(id);
  if (
    !flight ||
    !(await canAccessFlight(principal.authorization, 'read', id))
  ) {
    return apiV1Error('not_found', 'Flight not found', 404);
  }
  const participant = await isFlightParticipant(principal.user.id, id);
  const requiredScope = participant ? 'flight.read.own' : 'flight.read.any';
  if (!principalHasScope(principal, requiredScope))
    return apiV1Error(
      'insufficient_scope',
      `The credential requires ${requiredScope}`,
      403,
    );

  const track = await (
    await import('$lib/db')
  ).db
    .selectFrom('flightTrack')
    .select(['pointCount', 'updatedAt', 'sourceFormat', 'sourceName'])
    .where('flightId', '=', id)
    .executeTakeFirst();
  return apiV1Data(
    toFlightDto(
      flight,
      track
        ? {
            pointCount: track.pointCount,
            updatedAt: track.updatedAt.toISOString(),
            sourceFormat: track.sourceFormat,
            sourceName: track.sourceName,
          }
        : null,
    ),
  );
};

export const PUT: RequestHandler = async ({ request, params }) => {
  const principal = await authenticateRestPrincipal({
    request,
    url: new URL(request.url),
  });
  if (!principal) return apiV1Unauthorized('flight.update.own');
  try {
    const id = parsePositiveId(params.id);
    const input = await parseJsonBody(request, flightInputSchema);
    await updateApiFlight(principal, id, input);
    const updated = await getFlight(id);
    if (!updated) return apiV1Error('not_found', 'Flight not found', 404);
    return apiV1Data(toFlightDto(updated));
  } catch (error) {
    return handleApiV1Error(error);
  }
};

export const DELETE: RequestHandler = async ({ request, params }) => {
  const principal = await authenticateRestPrincipal({
    request,
    url: new URL(request.url),
  });
  if (!principal) return apiV1Unauthorized('flight.delete.own');
  try {
    await deleteApiFlight(principal, parsePositiveId(params.id));
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiV1Error(error);
  }
};
