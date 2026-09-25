import { toUserDto } from '$lib/api/v1/dto';
import { effectiveApiPermissions } from '../access';
import type { ApiPrincipal } from '../principal';

/** The caller's identity, role, effective permissions and credential. */
export const getProfile = (principal: ApiPrincipal) => ({
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
});
