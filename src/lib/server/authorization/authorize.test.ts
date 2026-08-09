import { describe, expect, it } from 'vitest';

import type { Permission } from '$lib/authorization/permissions';
import type { AuthorizationContext } from './context';
import { hasPermission, permissionsAreSubset } from './authorize';

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
});
