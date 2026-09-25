import { json } from '@sveltejs/kit';

import { parseFlightScope } from '$lib/server/api/v1/query';
import { visibleFlightScope } from '$lib/server/api/v1/services/flights';
import { legacyApiRoute } from '$lib/server/utils/api';
import { listFlightsInScope } from '$lib/server/utils/flight';

export const GET = legacyApiRoute(async ({ principal, event }) => {
  const scope = visibleFlightScope(
    principal,
    parseFlightScope(event.url.searchParams),
    'read',
  );
  return json({ success: true, flights: await listFlightsInScope(scope) });
});
