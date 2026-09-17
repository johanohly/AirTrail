import { apiRoute } from '$lib/server/api/v1/route';
import { apiV1Data } from '$lib/server/api/v1/response';
import { listCustomFields } from '$lib/server/api/v1/services/personal';

export const GET = apiRoute('custom_fields.read', async ({ principal }) =>
  apiV1Data(await listCustomFields(principal)),
);
