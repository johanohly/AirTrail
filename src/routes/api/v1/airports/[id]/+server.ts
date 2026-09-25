import { parsePositiveId } from '$lib/server/api/v1/params';
import { apiRoute } from '$lib/server/api/v1/route';
import { apiV1Data } from '$lib/server/api/v1/response';
import { getAirport } from '$lib/server/api/v1/services/reference';

export const GET = apiRoute('api-v1-get-airport', async ({ event }) =>
  apiV1Data(await getAirport(parsePositiveId(event.params.id!))),
);
