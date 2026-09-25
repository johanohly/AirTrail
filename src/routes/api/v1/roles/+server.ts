import { roleInputSchema } from '$lib/zod/role';
import { parseJsonBody } from '$lib/server/api/v1/body';
import { apiRoute } from '$lib/server/api/v1/route';
import { apiV1Data } from '$lib/server/api/v1/response';
import { createRole, listRoles } from '$lib/server/authorization/roles';

export const GET = apiRoute('api-v1-list-roles', async () =>
  apiV1Data(await listRoles()),
);

export const POST = apiRoute(
  'api-v1-create-role',
  async ({ principal, event }) => {
    const input = await parseJsonBody(event.request, roleInputSchema);
    const id = await createRole(input, principal.authorization);
    return apiV1Data({ id }, { status: 201 });
  },
);
