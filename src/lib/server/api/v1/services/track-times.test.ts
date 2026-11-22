import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiPrincipal } from '../principal';
import type { FlightTrackInput } from '$lib/track/schema';

const mocks = vi.hoisted(() => ({
  steps: [] as string[],
  saveFlightAggregate: vi.fn(),
  airport: { id: 1, tz: 'UTC' },
}));

/*
 * Every query resolves to the same airport row, and a transaction runs on a
 * marked connection so the tests can tell which writes share it.
 */
vi.mock('$lib/db', () => {
  const transaction = () => ({
    execute: (run: (trx: object) => unknown) => run({ trx: true }),
  });
  const query: object = new Proxy(() => query, {
    get: (_, key) => {
      if (key === 'then') return undefined;
      if (key === 'transaction') return transaction;
      if (key === 'executeTakeFirst') return async () => mocks.airport;
      return query;
    },
    apply: () => query,
  });
  return { db: query };
});

vi.mock('../access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../access')>()),
  requireFlightScope: async () => 'own',
}));

vi.mock('$lib/db/queries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/db/queries')>()),
  upsertFlightTrackPrimitiveWithConnection: async (connection: object) => {
    mocks.steps.push(`upsert ${'trx' in connection}`);
  },
}));

vi.mock('$lib/server/utils/flight', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/utils/flight')>()),
  saveFlightAggregate: mocks.saveFlightAggregate,
  fillFlightTimesFromTrackWithConnection: async (connection: object) => {
    mocks.steps.push(`fill ${'trx' in connection}`);
  },
  getFlight: async () => null,
}));

const { setFlightTrack } = await import('./tracks');
const { createFlight, updateFlight } = await import('./flights');

const principal = {
  user: { id: 'me' },
  authorization: { userId: 'me', isOwner: true, permissions: new Set() },
} as unknown as ApiPrincipal;

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

const input: Parameters<typeof createFlight>[1] = {
  date: '1970-01-01',
  datePrecision: 'day',
  departure: null,
  arrival: null,
  departureScheduled: '1970-01-01T07:00:00.000Z',
  arrivalScheduled: null,
  takeoffScheduled: null,
  takeoffActual: null,
  landingScheduled: null,
  landingActual: null,
  duration: null,
  departureTerminal: null,
  departureGate: null,
  arrivalTerminal: null,
  arrivalGate: null,
  flightNumber: null,
  aircraftReg: null,
  note: null,
  fromId: 1,
  toId: 1,
  aircraftId: null,
  airlineId: null,
  passengers: [],
  customFields: {},
  track,
};

// Reading the updated flight back fails on the stub; only the write matters.
const update = (body: typeof input) =>
  updateFlight(principal, 1, body).catch(() => {});
const savedValues = () => mocks.saveFlightAggregate.mock.calls[0]![1].values;

beforeEach(() => {
  mocks.steps = [];
  mocks.saveFlightAggregate.mockReset().mockResolvedValue(1);
});

describe('track times on API and MCP writes', () => {
  it('fills times in the same transaction that stores the track', async () => {
    // Reading the stored track back fails on the stub row; the writes are done.
    await setFlightTrack(principal, 1, track).catch(() => {});
    expect(mocks.steps).toEqual(['upsert true', 'fill true']);
  });

  it('fills empty times when a flight is created with a track', async () => {
    await createFlight(principal, input);
    expect(savedValues()).toMatchObject({
      takeoffActual: '1970-01-01T07:00:00.000Z',
      landingActual: '1970-01-01T08:59:00.000Z',
    });
  });

  it('keeps a time sent with the update', async () => {
    await update({ ...input, takeoffActual: '1970-01-01T07:10:00.000Z' });
    expect(savedValues()).toMatchObject({
      takeoffActual: '1970-01-01T07:10:00.000Z',
      landingActual: '1970-01-01T08:59:00.000Z',
    });
  });

  it('fills nothing on an update that keeps the stored track', async () => {
    await update({ ...input, track: undefined });
    expect(savedValues()).toMatchObject({
      takeoffActual: null,
      landingActual: null,
    });
  });
});
