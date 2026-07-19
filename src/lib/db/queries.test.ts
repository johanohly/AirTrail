import { describe, expect, it } from 'vitest';

import { resolveFlightPassengerChanges } from './queries';
import type { CreateFlightPassenger } from './types';

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

describe('resolveFlightPassengerChanges', () => {
  const existing = [
    { id: 1, userId: 'user-one', guestName: null },
    { id: 2, userId: null, guestName: 'Guest' },
  ];

  it('preserves IDs supplied by the flight form', () => {
    const incoming = { ...passenger('user-one'), id: 1 };
    const result = resolveFlightPassengerChanges(existing, [incoming]);

    expect(result.resolved[0]?.existing?.id).toBe(1);
    expect(result.removedIds).toEqual([2]);
  });

  it('preserves IDs for legacy payloads by passenger identity', () => {
    const result = resolveFlightPassengerChanges(existing, [
      passenger(null, 'Guest'),
    ]);

    expect(result.resolved[0]?.existing?.id).toBe(2);
    expect(result.removedIds).toEqual([1]);
  });

  it('rejects IDs from another flight', () => {
    expect(() =>
      resolveFlightPassengerChanges(existing, [
        { ...passenger('user-one'), id: 99 },
      ]),
    ).toThrow('Passenger does not belong to this flight');
  });
});
