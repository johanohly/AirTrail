import { describe, expect, it, vi } from 'vitest';

import { processLegacyAirTrailFile } from './legacy-airtrail';

vi.mock('$app/state', () => ({
  page: { data: { user: { id: 'local-user', username: 'john' } } },
}));

vi.mock('$lib/utils/data/airports/cache', () => ({
  getAirportByIcao: vi.fn(async (icao: string) => ({ id: 1, icao })),
}));

vi.mock('$lib/utils/data/airlines', () => ({
  getAirlineByIcao: vi.fn(async (icao: string) => ({ id: 2, icao })),
}));

vi.mock('$lib/utils/data/aircraft', () => ({
  getAircraftByIcao: vi.fn(async (icao: string) => ({ id: 3, icao })),
}));

const options = {
  filterOwner: false,
  airlineFromFlightNumber: false,
  importMode: 'personal' as const,
};

describe('processLegacyAirTrailFile', () => {
  it('moves the flight reason onto the passengers', async () => {
    const content = JSON.stringify({
      users: [{ id: 'old-user', username: 'john', displayName: 'John' }],
      flights: [
        {
          date: '2023-03-02',
          from: { code: 'EKCH' },
          to: { code: 'EGLL' },
          departure: null,
          arrival: null,
          duration: null,
          airline: 'SAS',
          flightNumber: 'SK501',
          aircraft: 'A20N',
          aircraftReg: null,
          flightReason: 'business',
          note: null,
          seats: [
            {
              userId: 'old-user',
              guestName: null,
              seat: 'window',
              seatNumber: '12A',
              seatClass: 'economy',
            },
          ],
        },
      ],
    });

    const { flights } = await processLegacyAirTrailFile(content, options);

    expect(flights[0]).not.toHaveProperty('flightReason');
    expect(flights[0]?.passengers).toEqual([
      expect.objectContaining({
        userId: 'local-user',
        flightReason: 'business',
      }),
    ]);
  });
});
