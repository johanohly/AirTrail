import { describe, expect, it } from 'vitest';

import { flightPassengerInformationSchema } from './flight';

const passenger = (userId: string | null, guestName: string | null) => ({
  userId,
  guestName,
  seat: null,
  seatNumber: null,
  seatClass: null,
  flightReason: null,
  customFields: {},
});

describe('flightPassengerInformationSchema', () => {
  it('rejects duplicate guest names regardless of case and whitespace', () => {
    const result = flightPassengerInformationSchema.safeParse({
      passengers: [
        passenger('user-one', null),
        passenger(null, 'Alice'),
        passenger(null, ' alice '),
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          message: 'Guest names must be unique within a flight',
        }),
      );
    }
  });

  it('accepts distinct guest names', () => {
    const result = flightPassengerInformationSchema.safeParse({
      passengers: [
        passenger('user-one', null),
        passenger(null, 'Alice'),
        passenger(null, 'Bob'),
      ],
    });

    expect(result.success).toBe(true);
  });
});
