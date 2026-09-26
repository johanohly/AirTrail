import { roleInputSchema } from '$lib/zod/role';
import { parseJsonBody } from '$lib/server/api/v1/body';
import { ApiOperationError } from '$lib/server/api/v1/errors';
import { apiRoute } from '$lib/server/api/v1/route';
import { apiV1Data } from '$lib/server/api/v1/response';
import { deleteRole, updateRole } from '$lib/server/authorization/roles';

export const PUT = apiRoute(
  'api-v1-update-role',
  async ({ principal, event }) => {
    const input = await parseJsonBody(event.request, roleInputSchema);
    await updateRole(event.params.id!, input, principal.authorization);
    return apiV1Data({ id: event.params.id, updated: true });
  },
);

export const DELETE = apiRoute(
  'api-v1-delete-role',
  async ({ principal, event }) => {
    const deleted = await deleteRole(event.params.id!, principal.authorization);
    if (!deleted) throw new ApiOperationError('not_found', 'Role not found');
    return new Response(null, { status: 204 });
  },
);
