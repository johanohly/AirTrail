import type { RequestHandler } from './$types';
import { authenticateRestPrincipal } from '$lib/server/api/v1/authenticate';
import { apiV1Unauthorized } from '$lib/server/api/v1/errors';
import { requireApiScope } from '$lib/server/api/v1/access';
import { apiV1Data, handleApiV1Error } from '$lib/server/api/v1/response';
import { updateRole, deleteRole } from '$lib/server/authorization/roles';
import { roleInputSchema } from '$lib/zod/role';
import { parseJsonBody } from '$lib/server/api/v1/body';
export const PUT: RequestHandler = async (event) => {
  const p = await authenticateRestPrincipal(event);
  if (!p) return apiV1Unauthorized('roles.manage');
  try {
    requireApiScope(p, 'roles.manage');
    await updateRole(
      event.params.id,
      await parseJsonBody(event.request, roleInputSchema),
      p.authorization,
    );
    return apiV1Data({ id: event.params.id, updated: true });
  } catch (e) {
    return handleApiV1Error(e);
  }
};
export const DELETE: RequestHandler = async (event) => {
  const p = await authenticateRestPrincipal(event);
  if (!p) return apiV1Unauthorized('roles.manage');
  try {
    requireApiScope(p, 'roles.manage');
    await deleteRole(event.params.id, p.authorization);
    return new Response(null, { status: 204 });
  } catch (e) {
    return handleApiV1Error(e);
  }
};
