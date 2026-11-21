import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiScope } from '$lib/api/v1/scopes';
import type { Permission } from '$lib/authorization/permissions';
import type { CreateFlight } from '$lib/db/types';
import { AuthorizationError } from '$lib/server/authorization/authorize';
import type { AuthorizationContext } from '$lib/server/authorization/context';

const mocks = vi.hoisted(() => ({
  getFlightPrimitive: vi.fn(),
  flightOwnership: vi.fn(),
  createFlightPrimitiveWithConnection: vi.fn(),
  updateFlightPrimitiveWithConnection: vi.fn(),
}));

vi.mock('$lib/db', () => ({
  db: {
    transaction: () => ({
      execute: (run: (trx: object) => unknown) => run({}),
    }),
  },
}));

vi.mock('$lib/db/queries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/db/queries')>()),
  getFlightPrimitive: mocks.getFlightPrimitive,
  createFlightPrimitiveWithConnection:
    mocks.createFlightPrimitiveWithConnection,
  updateFlightPrimitiveWithConnection:
    mocks.updateFlightPrimitiveWithConnection,
}));

vi.mock('$lib/server/authorization/flight', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('$lib/server/authorization/flight')
  >()),
  flightOwnership: mocks.flightOwnership,
}));

vi.mock('$lib/server/utils/custom-fields', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/utils/custom-fields')>()),
  prepareEntityCustomFieldPlan: async () => ({
    entityType: 'flight',
    definitions: [],
    entities: [],
  }),
  validateEntityCustomFieldPlan: () => {},
  persistEntityCustomFieldPlan: async () => {},
}));

const { saveFlightAggregate } = await import('./flight');

const role = (...permissions: Permission[]): AuthorizationContext => ({
  userId: 'me',
  isOwner: false,
  roleId: 'role',
  roleName: 'Role',
  roleAssignmentSource: 'local',
  permissions: new Set(permissions),
});

/** A writer whose credential holds `granted`, recording every scope checked. */
const writer = (
  authorization: AuthorizationContext,
  granted: ApiScope[] | 'all' = 'all',
) => {
  const checked: ApiScope[] = [];
  return {
    checked,
    authorization,
    requireScope: (scope: ApiScope) => {
      checked.push(scope);
      if (granted !== 'all' && !granted.includes(scope))
        throw new Error(`missing ${scope}`);
    },
  };
};

const passenger = (userId: string | null, id?: number) => ({
  ...(id === undefined ? {} : { id }),
  userId,
  guestName: userId ? null : 'Guest',
  seat: null,
  seatNumber: null,
  seatClass: null,
  flightReason: null,
});

const values = (
  passengers: ReturnType<typeof passenger>[],
  extra: Partial<CreateFlight> = {},
) => ({ passengers, ...extra }) as unknown as CreateFlight;

const create = (w: ReturnType<typeof writer>, flight: CreateFlight) =>
  saveFlightAggregate(w, { id: null, values: flight, customFields: {} });
const update = (w: ReturnType<typeof writer>, flight: CreateFlight) =>
  saveFlightAggregate(w, { id: 1, values: flight, customFields: {} });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createFlightPrimitiveWithConnection.mockResolvedValue({
    flightId: 7,
    passengers: [],
  });
  mocks.updateFlightPrimitiveWithConnection.mockResolvedValue([]);
  mocks.getFlightPrimitive.mockResolvedValue({
    id: 1,
    passengers: [passenger('me', 10)],
  });
  mocks.flightOwnership.mockResolvedValue('own');
});

describe('creating a flight', () => {
  it('needs only create.own for a flight with just the caller', async () => {
    const w = writer(role('flight.create.own'));
    await expect(create(w, values([passenger('me')]))).resolves.toBe(7);
    expect(w.checked).toEqual(['flight.create.own']);
  });

  it('needs the passenger scope for a second passenger', async () => {
    const w = writer(
      role('flight.create.own', 'flight.passengers.manage.own'),
      ['flight.create.own'],
    );
    await expect(
      create(w, values([passenger('me'), passenger('other')])),
    ).rejects.toThrow('missing flight.passengers.manage.own');
    expect(mocks.createFlightPrimitiveWithConnection).not.toHaveBeenCalled();
  });

  it('needs the .any scopes for a flight without the caller', async () => {
    const w = writer(role('flight.create.any', 'flight.passengers.manage.any'));
    await create(w, values([passenger('a'), passenger('b')]));
    expect(w.checked).toEqual([
      'flight.create.any',
      'flight.passengers.manage.any',
    ]);
  });

  it('refuses a role that cannot create before checking the credential', async () => {
    const w = writer(role('flight.read.own'));
    await expect(create(w, values([passenger('me')]))).rejects.toBeInstanceOf(
      AuthorizationError,
    );
    expect(w.checked).toEqual([]);
  });

  it('treats a track in the payload, even null, as a track write', async () => {
    const w = writer(role('flight.create.own'), ['flight.create.own']);
    await expect(
      create(w, values([passenger('me')], { track: null })),
    ).rejects.toThrow('missing tracks.write');
  });
});

describe('updating a flight', () => {
  it('reports a missing flight as not found', async () => {
    mocks.getFlightPrimitive.mockResolvedValue(undefined);
    const w = writer(role('flight.update.any'));
    await expect(
      update(w, values([passenger('me', 10)])),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("masks someone else's flight as not found for an own-only role", async () => {
    mocks.flightOwnership.mockResolvedValue('any');
    const w = writer(role('flight.update.own'));
    await expect(
      update(w, values([passenger('me', 10)])),
    ).rejects.toMatchObject({ status: 404 });
    expect(w.checked).toEqual([]);
  });

  it('needs no passenger scope when passengers are unchanged', async () => {
    const w = writer(role('flight.update.own'));
    await expect(update(w, values([passenger('me', 10)]))).resolves.toBe(1);
    expect(w.checked).toEqual(['flight.update.own']);
  });

  it('needs the passenger scope when passengers change', async () => {
    const w = writer(
      role('flight.update.own', 'flight.passengers.manage.own'),
      ['flight.update.own'],
    );
    await expect(
      update(w, values([passenger('me', 10), passenger('other')])),
    ).rejects.toThrow('missing flight.passengers.manage.own');
    expect(mocks.updateFlightPrimitiveWithConnection).not.toHaveBeenCalled();
  });

  it('masks a passenger change the role cannot make as not found', async () => {
    const w = writer(role('flight.update.own'));
    await expect(
      update(w, values([passenger('me', 10), passenger('other')])),
    ).rejects.toMatchObject({ status: 404 });
  });
});
