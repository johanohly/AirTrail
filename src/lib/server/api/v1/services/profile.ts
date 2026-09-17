import { toUserDto } from '$lib/api/v1/dto';
import { effectiveApiPermissions, requireApiScope } from '../access';
import type { ApiPrincipal } from '../principal';

/*
 * Reads the caller's own identity, role and effective permissions. This is
 * privileged: it discloses the full RBAC profile, so it costs `profile.read`
 * like every other resource. The MCP profile tool and resource previously
 * returned it with no scope check at all.
 */
export const getProfile = (principal: ApiPrincipal) => {
  requireApiScope(principal, 'profile.read');
  return {
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
  };
};
