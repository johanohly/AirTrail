import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiScope } from '$lib/api/v1/scopes';
import type { Permission } from '$lib/authorization/permissions';
import type { ApiPrincipal } from './principal';

const flightOwnership = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/authorization/flight', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('$lib/server/authorization/flight')
  >()),
  flightOwnership,
}));

const { requireApiScope, requireFlightScope, requireOperation } =
  await import('./access');

const principal = (
  scopes: ApiScope[],
  permissions: Permission[],
): ApiPrincipal =>
  ({
    user: { id: 'me' },
    authorization: {
      userId: 'me',
      isOwner: false,
      roleId: 'role',
      roleName: 'Role',
      roleAssignmentSource: 'local',
      permissions: new Set(permissions),
    },
    credential: { kind: 'apiKey', keyId: 1, scopes: new Set(scopes) },
  }) as unknown as ApiPrincipal;

beforeEach(() => flightOwnership.mockReset());

describe('requireApiScope', () => {
  it('tells a missing scope apart from a role that forbids it', () => {
    expect(() =>
      requireApiScope(principal([], ['flight.read.own']), 'flight.read.own'),
    ).toThrow(expect.objectContaining({ code: 'insufficient_scope' }));
    expect(() =>
      requireApiScope(principal(['flight.read.own'], []), 'flight.read.own'),
    ).toThrow(expect.objectContaining({ code: 'forbidden' }));
  });
});

describe('requireOperation', () => {
  it('requires every registered scope', () => {
    const caller = principal(['stats.read'], ['flight.read.own']);
    expect(() => requireOperation(caller, 'api-v1-get-stats')).toThrow(
      'flight.read.own',
    );
  });
});

describe('requireFlightScope', () => {
  it("needs the .any scope for someone else's flight", async () => {
    flightOwnership.mockResolvedValue('any');
    const caller = principal(['flight.read.own'], ['flight.read.any']);
    await expect(requireFlightScope(caller, 'read', 1)).rejects.toMatchObject({
      code: 'insufficient_scope',
    });
  });

  it("hides someone else's flight from an own-only role", async () => {
    flightOwnership.mockResolvedValue('any');
    const caller = principal(['flight.read.any'], ['flight.read.own']);
    await expect(requireFlightScope(caller, 'read', 1)).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('accepts the .own scope on a flight the caller is on', async () => {
    flightOwnership.mockResolvedValue('own');
    const caller = principal(['flight.update.own'], ['flight.update.own']);
    await expect(requireFlightScope(caller, 'update', 1)).resolves.toBe('own');
  });
});
