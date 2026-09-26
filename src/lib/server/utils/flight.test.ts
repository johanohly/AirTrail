import { describe, expect, it } from 'vitest';

import type { CreateFlightPassenger } from '$lib/db/types';
import { passengerRecordsChanged } from './flight';

const passenger = (
  userId: string | null,
  guestName: string | null = null,
): CreateFlightPassenger => ({
  userId,
  guestName,
  seat: null,
  seatNumber: null,
  seatClass: null,
  flightReason: null,
});

const persistedPassenger = (
  id: number,
  userId: string | null,
  guestName: string | null = null,
) => ({ ...passenger(userId, guestName), id });

describe('flight passenger change planning', () => {
  const userPassenger = persistedPassenger(1, 'user-one');
  const guestPassenger = persistedPassenger(2, null, 'Guest');
  const existing = [userPassenger, guestPassenger];

  it('does not treat display ordering as a passenger change', () => {
    expect(
      passengerRecordsChanged(existing, [guestPassenger, userPassenger]),
    ).toBe(false);
  });

  it('resolves legacy passengers without IDs by identity', () => {
    expect(
      passengerRecordsChanged(existing, [
        passenger('user-one'),
        passenger(null, 'Guest'),
      ]),
    ).toBe(false);
  });

  it('detects passenger metadata changes', () => {
    expect(
      passengerRecordsChanged(existing, [
        { ...userPassenger, seat: 'window' },
        guestPassenger,
      ]),
    ).toBe(true);
  });

  it('detects added and removed passengers', () => {
    expect(passengerRecordsChanged(existing, [userPassenger])).toBe(true);
    expect(
      passengerRecordsChanged(existing, [...existing, passenger('user-three')]),
    ).toBe(true);
  });
});
