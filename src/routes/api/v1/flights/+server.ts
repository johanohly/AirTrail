import type { RequestHandler } from './$types';

import {
  parseFlightScopeSearchParams,
  resolveFlightScope,
} from '$lib/flight-scope';
import { toFlightDto } from '$lib/api/v1/dto';
import { flightInputSchema } from '$lib/api/v1/schemas';
import { canListFlights } from '$lib/server/authorization/flight';
import { hasPermission } from '$lib/authorization/permissions';
import {
  apiV1Error,
  apiV1Unauthorized,
  responseHeaders,
} from '$lib/server/api/v1/errors';
import { principalHasScope } from '$lib/server/api/v1/principal';
import { listFlightsPage, parsePage } from '$lib/server/api/v1/flight-read';
import { authenticateRestPrincipal } from '$lib/server/api/v1/authenticate';
import {
  apiV1Collection,
  apiV1Data,
  handleApiV1Error,
} from '$lib/server/api/v1/response';
import { parseJsonBody } from '$lib/server/api/v1/body';
import { createApiFlight } from '$lib/server/api/v1/flight-write';

export const GET: RequestHandler = async ({ request, url }) => {
  const principal = await authenticateRestPrincipal({ request, url });
  if (!principal) return apiV1Unauthorized('flight.read.own');

  const parsedScope = parseFlightScopeSearchParams(url.searchParams);
  if (!parsedScope.success) {
    return apiV1Error(
      'bad_request',
      parsedScope.reason === 'missing_user'
        ? 'A userId query parameter is required for user scope'
        : 'Invalid scope',
      400,
    );
  }
  const requiredScope =
    parsedScope.data.scope === 'all' ||
    (parsedScope.data.scope === 'user' &&
      parsedScope.data.userId !== principal.user.id)
      ? 'flight.read.any'
      : 'flight.read.own';
  if (!principalHasScope(principal, requiredScope)) {
    return apiV1Error(
      'insufficient_scope',
      'The credential cannot read the requested flight scope',
      403,
    );
  }
  const canReadScope =
    parsedScope.data.scope === 'user' &&
    parsedScope.data.userId === principal.user.id
      ? hasPermission(principal.authorization, 'flight.read.own')
      : canListFlights(principal.authorization, parsedScope.data);
  if (!canReadScope) {
    return apiV1Error(
      'forbidden',
      'The current user cannot read this scope',
      403,
    );
  }

  const page = parsePage(
    url.searchParams.get('limit'),
    url.searchParams.get('cursor'),
  );
  if (!page) return apiV1Error('bad_request', 'Invalid pagination', 400);

  const result = await listFlightsPage(
    resolveFlightScope(parsedScope.data, principal.user.id),
    page,
  );
  if (!result) return apiV1Error('bad_request', 'Invalid cursor', 400);

  return apiV1Collection(
    result.flights.map((flight) =>
      toFlightDto(flight, result.tracks.get(flight.id) ?? null),
    ),
    { nextCursor: result.nextCursor },
  );
};

export const POST: RequestHandler = async ({ request, url }) => {
  const principal = await authenticateRestPrincipal({ request, url });
  if (!principal) return apiV1Unauthorized('flight.create.own');
  try {
    const input = await parseJsonBody(request, flightInputSchema);
    const id = await createApiFlight(principal, input);
    return apiV1Data(
      { id },
      { status: 201, headers: { Location: `/api/v1/flights/${id}` } },
    );
  } catch (error) {
    return handleApiV1Error(error);
  }
};
