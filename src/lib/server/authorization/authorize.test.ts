import { describe, expect, it } from 'vitest';

import {
  canCreateUserAccount,
  canDeduplicateOwnFlights,
  canRestoreAllFlights,
  canSetDefaultRole,
  permissionsStrictlyInclude,
  type Permission,
} from '$lib/authorization/permissions';
import type { AuthorizationContext } from './context';
import { hasPermission, permissionsAreSubset } from './authorize';
import { canActOnUserWithPermissions } from './users';

const context = (
  permissions: Permission[],
  isOwner = false,
): AuthorizationContext => ({
  userId: 'user-1',
  isOwner,
  roleId: isOwner ? null : 'role-1',
  roleName: isOwner ? null : 'Role',
  roleAssignmentSource: 'local',
  permissions: new Set(permissions),
});

describe('RBAC authorization', () => {
  it('lets an any permission satisfy its own equivalent', () => {
    const authorization = context(['flight.read.any']);
    expect(hasPermission(authorization, 'flight.read.any')).toBe(true);
    expect(hasPermission(authorization, 'flight.read.own')).toBe(true);
  });

  it('does not let an own permission satisfy any access', () => {
    expect(hasPermission(context(['flight.read.own']), 'flight.read.any')).toBe(
      false,
    );
  });

  it('prevents roles from granting permissions the actor lacks', () => {
    expect(
      permissionsAreSubset(
        ['flight.read.own', 'flight.delete.any'],
        context(['flight.read.any']),
      ),
    ).toBe(false);
  });

  it('gives the owner every permission without a role', () => {
    expect(hasPermission(context([], true), 'tools.sql.execute')).toBe(true);
  });

  it('compares role hierarchy using effective permissions', () => {
    expect(
      permissionsStrictlyInclude(['flight.read.any'], ['flight.read.own']),
    ).toBe(true);
    expect(
      permissionsStrictlyInclude(
        ['flight.read.any'],
        ['flight.read.any', 'flight.read.own'],
      ),
    ).toBe(false);
  });

  it('only manages users whose effective permissions are strictly lower', () => {
    const authorization = context(['flight.read.any']);

    expect(
      canActOnUserWithPermissions(
        authorization,
        { isOwner: false, roleId: 'lower-role' },
        ['flight.read.own'],
      ),
    ).toBe(true);
    expect(
      canActOnUserWithPermissions(
        authorization,
        { isOwner: false, roleId: 'peer-role' },
        ['flight.read.any'],
      ),
    ).toBe(false);
    expect(
      canActOnUserWithPermissions(
        authorization,
        { isOwner: true, roleId: null },
        [],
      ),
    ).toBe(false);
  });

  it('keeps composed actions unavailable until every permission is present', () => {
    expect(canCreateUserAccount(context(['users.create']))).toBe(false);
    expect(
      canCreateUserAccount(context(['users.create', 'users.roles.assign'])),
    ).toBe(true);

    expect(canRestoreAllFlights(context(['flight.import.any']))).toBe(false);
    expect(
      canRestoreAllFlights(
        context(['flight.import.any', 'users.directory.read']),
      ),
    ).toBe(true);

    expect(canDeduplicateOwnFlights(context(['flight.delete.own']))).toBe(
      false,
    );
    expect(
      canDeduplicateOwnFlights(
        context(['flight.read.own', 'flight.delete.own']),
      ),
    ).toBe(true);

    expect(
      canSetDefaultRole(context(['roles.manage', 'users.roles.assign'])),
    ).toBe(false);
    expect(
      canSetDefaultRole(
        context([
          'roles.manage',
          'users.roles.assign',
          'instance.oauth.manage',
        ]),
      ),
    ).toBe(true);
  });
});
