import { parsePositiveId } from '$lib/server/api/v1/body';
import { apiRoute } from '$lib/server/api/v1/route';
import { apiV1Data } from '$lib/server/api/v1/response';
import { getAirline } from '$lib/server/api/v1/services/reference';

export const GET = apiRoute(
  'reference_data.read',
  async ({ principal, event }) =>
    apiV1Data(await getAirline(principal, parsePositiveId(event.params.id!))),
);
