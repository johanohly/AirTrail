import { describe, expect, it } from 'vitest';
import { API_SCOPES, isApiScope } from '$lib/api/v1/scopes';
import { flightInputSchema } from '$lib/api/v1/schemas';
import { pkceChallenge } from '$lib/server/oauth/server';
import { effectiveApiPermissions } from '$lib/server/api/v1/access';
import { PERMISSIONS } from '$lib/authorization/permissions';

describe('public API contract', () => {
  it('keeps scope catalog stable and rejects unknown scopes', () => {
    expect(API_SCOPES).toContain('flight.read.own');
    expect(isApiScope('flight.read.own')).toBe(true);
    expect(isApiScope('admin')).toBe(false);
  });

  it('requires exactly one passenger identity', () => {
    const base = {
      date: '2026-01-01',
      fromId: 1,
      toId: 2,
      passengers: [{ userId: 'user-1', guestName: null }],
    };
    expect(flightInputSchema.safeParse(base).success).toBe(true);
    expect(
      flightInputSchema.safeParse({
        ...base,
        passengers: [{ userId: null, guestName: null }],
      }).success,
    ).toBe(false);
    expect(
      flightInputSchema.safeParse({
        ...base,
        passengers: [{ userId: 'u', guestName: 'g' }],
      }).success,
    ).toBe(false);
  });

  it('generates RFC 7636 S256 challenges', () => {
    expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });

  it('reports effective permissions for owners and implied role grants', () => {
    expect(
      effectiveApiPermissions({
        authorization: {
          userId: 'owner',
          isOwner: true,
          roleId: null,
          roleName: null,
          roleAssignmentSource: 'local',
          permissions: new Set(),
        },
      }),
    ).toEqual(PERMISSIONS);
    expect(
      effectiveApiPermissions({
        authorization: {
          userId: 'admin',
          isOwner: false,
          roleId: 'role-admin',
          roleName: 'Admin',
          roleAssignmentSource: 'local',
          permissions: new Set(['flight.read.any']),
        },
      }),
    ).toEqual(expect.arrayContaining(['flight.read.any', 'flight.read.own']));
  });
});
