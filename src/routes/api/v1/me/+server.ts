import { apiRoute } from '$lib/server/api/v1/route';
import { apiV1Data } from '$lib/server/api/v1/response';
import { getProfile } from '$lib/server/api/v1/services/profile';

export const GET = apiRoute('profile.read', ({ principal }) =>
  apiV1Data(getProfile(principal)),
);
