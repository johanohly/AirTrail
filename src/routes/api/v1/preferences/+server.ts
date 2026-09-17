import { updatePreferencesSchema } from '$lib/zod/user';
import { parseJsonBody } from '$lib/server/api/v1/body';
import { apiRoute } from '$lib/server/api/v1/route';
import { apiV1Data } from '$lib/server/api/v1/response';
import { updatePreferences } from '$lib/server/api/v1/services/personal';

export const PUT = apiRoute(
  'preferences.write',
  async ({ principal, event }) => {
    const input = await parseJsonBody(event.request, updatePreferencesSchema);
    return apiV1Data(await updatePreferences(principal, input));
  },
);
