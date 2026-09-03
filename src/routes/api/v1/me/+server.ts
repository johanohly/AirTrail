import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { apiV1Unauthorized } from '$lib/server/api/v1/errors';
import { toUserDto } from '$lib/api/v1/dto';
import { authenticateRestPrincipal } from '$lib/server/api/v1/authenticate';
import {
  effectiveApiPermissions,
  requireApiScope,
} from '$lib/server/api/v1/access';
import { handleApiV1Error } from '$lib/server/api/v1/response';

export const GET: RequestHandler = async ({ request, url }) => {
  const principal = await authenticateRestPrincipal({
    request,
    url,
  });
  if (!principal) return apiV1Unauthorized('profile.read');
  try {
    requireApiScope(principal, 'profile.read');
    return json(
      {
        data: {
          ...toUserDto(principal.user),
          role: principal.authorization.roleName
            ? {
                id: principal.authorization.roleId,
                name: principal.authorization.roleName,
              }
            : null,
          isOwner: principal.authorization.isOwner,
          permissions: effectiveApiPermissions(principal),
          credential: {
            kind: principal.credential.kind,
            scopes: [...principal.credential.scopes],
          },
        },
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return handleApiV1Error(error);
  }
};
