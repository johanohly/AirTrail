import { apiRoute } from '$lib/server/api/v1/route';
import { apiV1Data } from '$lib/server/api/v1/response';
import { listDirectoryUsers } from '$lib/server/authorization/users';

export const GET = apiRoute('users.directory.read', async ({ principal }) =>
  apiV1Data(await listDirectoryUsers(principal.authorization)),
);
