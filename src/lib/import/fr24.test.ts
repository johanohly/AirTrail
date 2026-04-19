import { beforeEach, describe, expect, it, vi } from 'vitest';

import { processFR24File } from './fr24';

const { getAirportByIcao, getAirlineByIcao, getAircraftByIcao } = vi.hoisted(
  () => ({
    getAirportByIcao: vi.fn(async (icao: string) => ({
      id: icao,
      icao,
      tz: 'UTC',
    })),
    getAirlineByIcao: vi.fn(async (icao: string) => ({ id: icao, icao })),
    getAircraftByIcao: vi.fn(async (icao: string) => ({ id: icao, icao })),
  }),
);

vi.mock('$app/state', () => ({
  page: {
    data: {
      user: {
        id: 'user-1',
      },
    },
  },
}));

vi.mock('$lib/utils/data/airports/cache', () => ({
  getAirportByIcao,
}));

vi.mock('$lib/utils/data/airlines', () => ({
  getAirlineByIcao,
}));

vi.mock('$lib/utils/data/aircraft', () => ({
  getAircraftByIcao,
}));

describe('processFR24File', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('imports month-only FR24 dates as month precision', async () => {
    const content = `Date,Flight number,From,To,Dep time,Arr time,Duration,Airline,Aircraft,Registration,Seat number,Seat type,Flight class,Flight reason,Note\n2006-02,,Dunedin / Momona (DUD/NZDN),Christchurch / Christchurch (CHC/NZCH),00:00:00,00:00:00,00:41:00,Air New Zealand (NZ/ANZ),ATR 72-200 (AT72),,,0,1,1,`;

    const result = await processFR24File(content, {
      filterOwner: false,
      airlineFromFlightNumber: true,
    });

    expect(result.flights).toHaveLength(1);
    expect(result.flights[0]?.date).toBe('2006-02-01');
    expect(result.flights[0]?.datePrecision).toBe('month');
    expect(result.flights[0]?.departure).toBeNull();
    expect(result.flights[0]?.arrival).toBeNull();
  });

  it('imports year-only FR24 dates as year precision', async () => {
    const content = `Date,Flight number,From,To,Dep time,Arr time,Duration,Airline,Aircraft,Registration,Seat number,Seat type,Flight class,Flight reason,Note\n2006,,Dunedin / Momona (DUD/NZDN),Christchurch / Christchurch (CHC/NZCH),00:00:00,00:00:00,00:41:00,Air New Zealand (NZ/ANZ),ATR 72-200 (AT72),,,0,1,1,`;

    const result = await processFR24File(content, {
      filterOwner: false,
      airlineFromFlightNumber: true,
    });

    expect(result.flights).toHaveLength(1);
    expect(result.flights[0]?.date).toBe('2006-01-01');
    expect(result.flights[0]?.datePrecision).toBe('year');
    expect(result.flights[0]?.departure).toBeNull();
    expect(result.flights[0]?.arrival).toBeNull();
  });
});
