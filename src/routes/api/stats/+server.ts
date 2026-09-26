import { json } from '@sveltejs/kit';

import { requireOperation } from '$lib/server/api/v1/access';
import { parseFlightScope } from '$lib/server/api/v1/query';
import { getFlightStats } from '$lib/server/api/v1/services/flights';
import { legacyApiRoute } from '$lib/server/utils/api';

export const GET = legacyApiRoute(async ({ principal, event }) => {
  requireOperation(principal, 'api-v1-get-stats');
  const stats = await getFlightStats(
    principal,
    parseFlightScope(event.url.searchParams),
  );
  return json({ success: true, stats });
});
