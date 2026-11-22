import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FlightTrackInput } from '$lib/track/schema';

const mocks = vi.hoisted(() => ({ saveFlightAggregate: vi.fn() }));

const airport = {
  id: 1,
  icao: 'EKCH',
  iata: 'CPH',
  tz: 'UTC',
  lat: 55.6,
  lon: 12.6,
};

vi.mock('$lib/server/utils/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/utils/api')>()),
  legacyApiRoute:
    (handler: (context: { principal: object; event: object }) => unknown) =>
    (event: object) =>
      handler({
        principal: { user: { id: 'me' }, authorization: { userId: 'me' } },
        event,
      }),
}));

vi.mock('$lib/server/utils/airport', () => ({
  getAirportByIcao: async () => airport,
  getAirportByIata: async () => airport,
}));

vi.mock('$lib/server/utils/flight', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/utils/flight')>()),
  saveFlightAggregate: mocks.saveFlightAggregate,
}));

const { POST } = await import('./+server');

// Takeoff at 07:00:30 UTC, landing at 08:59:45 UTC.
const track: FlightTrackInput = {
  sourceFormat: 'kml',
  sourceName: null,
  coordinates: [
    [0, 0, 0],
    [0, 0, 10],
    [0, 0, 10],
    [0, 0, 0],
  ],
  times: [25170, 25230, 32370, 32385],
};

const save = (body: Record<string, unknown>) =>
  (POST as (event: object) => Promise<Response>)({
    request: new Request('http://airtrail.example/api/flight/save', {
      method: 'POST',
      body: JSON.stringify({
        from: 'EKCH',
        to: 'EKCH',
        departure: '1970-01-01T00:00:00.000Z',
        departureTime: '07:00',
        passengers: [{ userId: '<USER_ID>' }],
        track,
        ...body,
      }),
    }),
  });

beforeEach(() => {
  mocks.saveFlightAggregate.mockReset().mockResolvedValue(1);
});

describe('legacy flight save with a track', () => {
  it('fills empty takeoff and landing times', async () => {
    expect((await save({})).status).toBe(200);
    expect(mocks.saveFlightAggregate.mock.calls[0]![1].values).toMatchObject({
      takeoffActual: '1970-01-01T07:00:00.000Z',
      landingActual: '1970-01-01T08:59:00.000Z',
    });
  });

  it('keeps a time sent in the request', async () => {
    await save({
      landingActual: '1970-01-01T00:00:00.000Z',
      landingActualTime: '09:05',
    });
    expect(mocks.saveFlightAggregate.mock.calls[0]![1].values).toMatchObject({
      takeoffActual: '1970-01-01T07:00:00.000Z',
      landingActual: '1970-01-01T09:05:00.000+00:00',
    });
  });
});
