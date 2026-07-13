import { describe, expect, it } from 'vitest';

import type { CreateFlight, User } from '$lib/db/types';

import { validateFlightImportPermissions } from './flight-import';

const user = {
  id: 'current-user',
  role: 'user',
} as Pick<User, 'id' | 'role'>;

const flightWithSeats = (seats: CreateFlight['seats']): CreateFlight =>
  ({ seats }) as CreateFlight;

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
