import { parsePositiveId } from '$lib/server/api/v1/params';
import { apiRoute } from '$lib/server/api/v1/route';
import { apiV1Data } from '$lib/server/api/v1/response';
import { getAirline } from '$lib/server/api/v1/services/reference';

export const GET = apiRoute('api-v1-get-airline', async ({ event }) =>
  apiV1Data(await getAirline(parsePositiveId(event.params.id!))),
);
