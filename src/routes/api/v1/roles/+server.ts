import type { RequestHandler } from './$types';
import { authenticateRestPrincipal } from '$lib/server/api/v1/authenticate';
import { apiV1Unauthorized } from '$lib/server/api/v1/errors';
import { requireApiScope } from '$lib/server/api/v1/access';
import { apiV1Data, handleApiV1Error } from '$lib/server/api/v1/response';
import {
  listRoles,
  createRole,
  updateRole,
  deleteRole,
} from '$lib/server/authorization/roles';
import { roleInputSchema } from '$lib/zod/role';
import { parseJsonBody } from '$lib/server/api/v1/body';
export const GET: RequestHandler = async (event) => {
  const p = await authenticateRestPrincipal(event);
  if (!p) return apiV1Unauthorized('roles.manage');
  try {
    requireApiScope(p, 'roles.manage');
    return apiV1Data(await listRoles());
  } catch (e) {
    return handleApiV1Error(e);
  }
};
export const POST: RequestHandler = async (event) => {
  const p = await authenticateRestPrincipal(event);
  if (!p) return apiV1Unauthorized('roles.manage');
  try {
    requireApiScope(p, 'roles.manage');
    const id = await createRole(
      await parseJsonBody(event.request, roleInputSchema),
      p.authorization,
    );
    return apiV1Data({ id }, { status: 201 });
  } catch (e) {
    return handleApiV1Error(e);
  }
};
