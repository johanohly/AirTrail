import { describe, expect, it } from 'vitest';

import type { Permission } from '$lib/authorization/permissions';
import type { AuthorizationContext } from './context';
import {
  canCreateFlight,
  canExportFlights,
  canListFlights,
  canShareOwnFlights,
} from './flight';

const context = (permissions: Permission[]): AuthorizationContext => ({
  userId: 'actor',
  isOwner: false,
  roleId: 'role',
  roleName: 'Role',
  roleAssignmentSource: 'local',
  permissions: new Set(permissions),
});

const actor = { userId: 'actor' };
const other = { userId: 'other' };

describe('flight authorization policy', () => {
  it.each([
    {
      name: 'creates a personal flight with create-own',
      permissions: ['flight.create.own'],
      passengers: [actor],
      allowed: true,
    },
    {
      name: 'does not create for someone else with create-own',
      permissions: ['flight.create.own'],
      passengers: [other],
      allowed: false,
    },
    {
      name: 'creates for one other passenger with create-any',
      permissions: ['flight.create.any'],
      passengers: [other],
      allowed: true,
    },
    {
      name: 'requires passenger management for multiple personal passengers',
      permissions: ['flight.create.own'],
      passengers: [actor, other],
      allowed: false,
    },
    {
      name: 'creates multiple personal passengers with passenger management',
      permissions: ['flight.create.own', 'flight.passengers.manage.own'],
      passengers: [actor, other],
      allowed: true,
    },
  ] satisfies Array<{
    name: string;
    permissions: Permission[];
    passengers: Array<{ userId: string }>;
    allowed: boolean;
  }>)('$name', ({ permissions, passengers, allowed }) => {
    expect(canCreateFlight(context(permissions), passengers)).toBe(allowed);
  });

  it('uses one scope rule for listing and exporting', () => {
    const own = context(['flight.read.own', 'flight.export.own']);
    expect(canListFlights(own, { scope: 'mine' })).toBe(true);
    expect(canListFlights(own, { scope: 'all' })).toBe(false);
    expect(canExportFlights(own, { scope: 'mine' })).toBe(true);
    expect(canExportFlights(own, { scope: 'user', userId: 'other' })).toBe(
      false,
    );
  });

  it('requires both read and publish permission for a share', () => {
    expect(canShareOwnFlights(context(['flight.read.own']))).toBe(false);
    expect(canShareOwnFlights(context(['flight.share.own']))).toBe(false);
    expect(
      canShareOwnFlights(context(['flight.read.own', 'flight.share.own'])),
    ).toBe(true);
  });
});
