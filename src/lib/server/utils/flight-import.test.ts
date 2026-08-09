import { describe, expect, it } from 'vitest';

import type { Permission } from '$lib/authorization/permissions';
import type { CreateFlight } from '$lib/db/types';
import type { AuthorizationContext } from '$lib/server/authorization/context';

import {
  getMissingFlightReferenceUpdate,
  getMissingImportPassengers,
  validateFlightImportPermissions,
} from './flight-import';

const authorization = (
  permissions: Permission[],
  isOwner = false,
): AuthorizationContext => ({
  userId: 'current-user',
  isOwner,
  roleId: isOwner ? null : 'role-user',
  roleName: isOwner ? null : 'User',
  roleAssignmentSource: 'local',
  permissions: new Set(permissions),
});

const user = authorization(['flight.import.own']);

const flightWithSeats = (
  passengers: CreateFlight['passengers'],
): CreateFlight => ({ passengers }) as CreateFlight;

const guestSeat = (
  guestName: string,
  seatNumber: string | null = null,
): CreateFlight['passengers'][number] => ({
  userId: null,
  guestName,
  seat: null,
  seatNumber,
  seatClass: null,
  flightReason: null,
});

const userSeat = (userId: string): CreateFlight['passengers'][number] => ({
  ...guestSeat(''),
  userId,
  guestName: null,
});

describe('getMissingImportPassengers', () => {
  it('preserves same-name guests with different seat details', () => {
    const incoming = [
      guestSeat('Guest Passenger', '12A'),
      guestSeat('Guest Passenger', '12B'),
    ];

    expect(getMissingImportPassengers([], incoming)).toEqual(incoming);
  });

  it('only skips the guest seat already on the flight', () => {
    const existing = [guestSeat('Guest Passenger', '12A')];
    const missing = getMissingImportPassengers(existing, [
      ...existing,
      guestSeat('Guest Passenger', '12B'),
    ]);

    expect(missing).toEqual([guestSeat('Guest Passenger', '12B')]);
  });

  it('preserves the number of identical guest rows', () => {
    const guest = guestSeat('Guest Passenger', '12A');

    expect(getMissingImportPassengers([guest], [guest, guest])).toEqual([
      guest,
    ]);
    expect(getMissingImportPassengers([guest, guest], [guest, guest])).toEqual(
      [],
    );
  });

  it('deduplicates repeated passengers for the same local user', () => {
    const userSeat = {
      ...guestSeat('Ignored'),
      userId: 'local-user',
      guestName: null,
    };

    expect(getMissingImportPassengers([], [userSeat, userSeat])).toEqual([
      userSeat,
    ]);
  });
});

describe('getMissingFlightReferenceUpdate', () => {
  it('fills missing airline and aircraft references', () => {
    expect(
      getMissingFlightReferenceUpdate(
        { airline: null, aircraft: null },
        { airline: { id: 12 }, aircraft: { id: 34 } },
      ),
    ).toEqual({ airlineId: 12, aircraftId: 34 });
  });

  it('does not replace existing references', () => {
    expect(
      getMissingFlightReferenceUpdate(
        {
          airline: { id: 1 },
          aircraft: { id: 2 },
        } as Parameters<typeof getMissingFlightReferenceUpdate>[0],
        { airline: { id: 12 }, aircraft: { id: 34 } },
      ),
    ).toBeNull();
  });

  it('ignores unresolved incoming references', () => {
    expect(
      getMissingFlightReferenceUpdate(
        { airline: null, aircraft: null },
        { airline: null, aircraft: null },
      ),
    ).toBeNull();
  });
});

describe('validateFlightImportPermissions', () => {
  it('allows personal imports owned by the importing user', () => {
    const error = validateFlightImportPermissions(
      user,
      [flightWithSeats([userSeat(user.userId), guestSeat('Guest Passenger')])],
      'personal',
    );

    expect(error).toBeNull();
  });

  it('rejects personal imports that assign another local user', () => {
    const error = validateFlightImportPermissions(
      user,
      [flightWithSeats([userSeat(user.userId), userSeat('other-user')])],
      'personal',
    );

    expect(error).toBe('Flight 1 assigns another user as a passenger');
  });

  it('requires the importing user on every personal flight', () => {
    const error = validateFlightImportPermissions(
      user,
      [flightWithSeats([guestSeat('Guest Passenger')])],
      'personal',
    );

    expect(error).toBe('Flight 1 must include the importing user');
  });

  it('reserves restore mode for admins and owners', () => {
    const flight = flightWithSeats([userSeat('other-user')]);

    expect(validateFlightImportPermissions(user, [flight], 'restore')).toBe(
      'You cannot restore flights for other users',
    );
    expect(
      validateFlightImportPermissions(
        authorization(['flight.import.any']),
        [flight],
        'restore',
      ),
    ).toBeNull();
    expect(
      validateFlightImportPermissions(
        authorization([], true),
        [flight],
        'restore',
      ),
    ).toBeNull();
  });
});
