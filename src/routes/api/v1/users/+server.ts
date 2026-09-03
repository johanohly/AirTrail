import type { RequestHandler } from './$types';
import { authenticateRestPrincipal } from '$lib/server/api/v1/authenticate';
import { apiV1Unauthorized } from '$lib/server/api/v1/errors';
import { requireApiScope } from '$lib/server/api/v1/access';
import { apiV1Data, handleApiV1Error } from '$lib/server/api/v1/response';
import { listDirectoryUsers } from '$lib/server/authorization/users';
export const GET: RequestHandler = async (event) => {
  const p = await authenticateRestPrincipal(event);
  if (!p) return apiV1Unauthorized('users.directory.read');
  try {
    requireApiScope(p, 'users.directory.read');
    return apiV1Data(await listDirectoryUsers(p.authorization));
  } catch (e) {
    return handleApiV1Error(e);
  }
};
