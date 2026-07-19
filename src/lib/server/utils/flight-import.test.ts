import { describe, expect, it } from 'vitest';

import type { CreateFlight, User } from '$lib/db/types';

import {
  getMissingImportPassengers,
  validateFlightImportPermissions,
} from './flight-import';

const user = {
  id: 'current-user',
  role: 'user',
} as Pick<User, 'id' | 'role'>;

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

describe('validateFlightImportPermissions', () => {
  it('allows personal imports owned by the importing user', () => {
    const error = validateFlightImportPermissions(
      user,
      [
        flightWithSeats([
          {
            userId: user.id,
            guestName: null,
            seat: null,
            seatNumber: null,
            seatClass: null,
          },
          {
            userId: null,
            guestName: 'Guest Passenger',
            seat: null,
            seatNumber: null,
            seatClass: null,
          },
        ]),
      ],
      'personal',
    );

    expect(error).toBeNull();
  });

  it('rejects personal imports that assign another local user', () => {
    const error = validateFlightImportPermissions(
      user,
      [
        flightWithSeats([
          {
            userId: user.id,
            guestName: null,
            seat: null,
            seatNumber: null,
            seatClass: null,
          },
          {
            userId: 'other-user',
            guestName: null,
            seat: null,
            seatNumber: null,
            seatClass: null,
          },
        ]),
      ],
      'personal',
    );

    expect(error).toBe('Flight 1 assigns a seat to another user');
  });

  it('requires the importing user on every personal flight', () => {
    const error = validateFlightImportPermissions(
      user,
      [
        flightWithSeats([
          {
            userId: null,
            guestName: 'Guest Passenger',
            seat: null,
            seatNumber: null,
            seatClass: null,
          },
        ]),
      ],
      'personal',
    );

    expect(error).toBe('Flight 1 must include the importing user');
  });

  it('reserves restore mode for admins and owners', () => {
    const flight = flightWithSeats([
      {
        userId: 'other-user',
        guestName: null,
        seat: null,
        seatNumber: null,
        seatClass: null,
      },
    ]);

    expect(validateFlightImportPermissions(user, [flight], 'restore')).toBe(
      'Only admins and owners can restore flights for other users',
    );
    expect(
      validateFlightImportPermissions(
        { ...user, role: 'admin' },
        [flight],
        'restore',
      ),
    ).toBeNull();
    expect(
      validateFlightImportPermissions(
        { ...user, role: 'owner' },
        [flight],
        'restore',
      ),
    ).toBeNull();
  });
});
