import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CreateFlightPassenger,
  DatabaseConnection,
  FlightPassenger,
} from '$lib/db/types';
import { validatePassengerFlightReasons } from './flight-reasons';
import {
  customFlightReasonsSchema,
  flightReasonLabel,
  flightReasonOptions,
} from '$lib/utils/flight-reasons';

const readSettings = vi.fn();
const selectFrom = vi.fn(() => ({
  select: () => ({ where: () => ({ executeTakeFirstOrThrow: readSettings }) }),
}));
const db = { selectFrom } as unknown as DatabaseConnection;
const passenger = (
  flightReason: string | null,
  userId: string | null = 'me',
): CreateFlightPassenger => ({
  userId,
  guestName: userId ? null : 'Guest',
  flightReason,
  seat: null,
  seatNumber: null,
  seatClass: null,
});
const stored = (reason: string, userId = 'me'): FlightPassenger => ({
  ...passenger(reason, userId),
  id: 10,
  flightId: 1,
  user: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  readSettings.mockResolvedValue({ customFlightReasons: ['Study abroad'] });
});

describe('passenger reason validation', () => {
  it('keeps built-ins locked and orders personal options before Other', () => {
    expect(flightReasonOptions(['Study abroad'])).toEqual([
      'leisure',
      'business',
      'crew',
      'Study abroad',
      'other',
    ]);
    expect(flightReasonLabel('VIP')).toBe('VIP');
    expect(customFlightReasonsSchema.parse([' Study abroad '])).toEqual([
      'Study abroad',
    ]);
    expect(customFlightReasonsSchema.parse([])).toEqual([]);
    for (const reasons of [
      ['Business'],
      ['crew'],
      ['other'],
      ['LEISURE'],
      ['Study', 'study'],
      [' '],
    ]) {
      expect(customFlightReasonsSchema.safeParse(reasons).success).toBe(false);
    }
  });
  it('accepts built-ins and None without reading custom settings', async () => {
    for (const reason of [null, 'leisure', 'business', 'crew', 'other']) {
      await validatePassengerFlightReasons(db, 'me', [passenger(reason)]);
    }
    expect(selectFrom).not.toHaveBeenCalled();
  });

  it('accepts an active custom reason only for the caller', async () => {
    await expect(
      validatePassengerFlightReasons(db, 'me', [passenger('Study abroad')]),
    ).resolves.toBeUndefined();
    for (const userId of ['other', null]) {
      await expect(
        validatePassengerFlightReasons(db, 'me', [
          passenger('Study abroad', userId),
        ]),
      ).rejects.toThrow('available flight reason');
    }
  });

  it('rejects removed reasons on new passengers', async () => {
    readSettings.mockResolvedValue({ customFlightReasons: [] });
    await expect(
      validatePassengerFlightReasons(db, 'me', [passenger('Study abroad')]),
    ).rejects.toThrow('available flight reason');
  });

  it('retains a removed reason on the same passenger with or without an explicit ID', async () => {
    for (const userId of ['me', 'other']) {
      for (const id of [undefined, 10]) {
        await expect(
          validatePassengerFlightReasons(
            db,
            'me',
            [{ ...passenger('Removed', userId), id }],
            [stored('Removed', userId)],
          ),
        ).resolves.toBeUndefined();
      }
    }
    expect(selectFrom).not.toHaveBeenCalled();
  });

  it('does not transfer a removed reason when the linked passenger changes', async () => {
    await expect(
      validatePassengerFlightReasons(
        db,
        'me',
        [{ ...passenger('Removed', 'other'), id: 10 }],
        [stored('Removed')],
      ),
    ).rejects.toThrow('available flight reason');
  });

  it('allows replacing a removed reason or clearing it', async () => {
    for (const reason of [null, 'business', 'Study abroad']) {
      await expect(
        validatePassengerFlightReasons(
          db,
          'me',
          [passenger(reason)],
          [stored('Removed')],
        ),
      ).resolves.toBeUndefined();
    }
  });
});
