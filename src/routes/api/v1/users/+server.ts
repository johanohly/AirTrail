import { apiRoute } from '$lib/server/api/v1/route';
import { apiV1Data } from '$lib/server/api/v1/response';
import { listDirectoryUsers } from '$lib/server/authorization/users';

export const GET = apiRoute('api-v1-list-users', async ({ principal }) =>
  apiV1Data(await listDirectoryUsers(principal.authorization)),
);
