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

  it('skips month-only FR24 dates with invalid months', async () => {
    const content = `Date,Flight number,From,To,Dep time,Arr time,Duration,Airline,Aircraft,Registration,Seat number,Seat type,Flight class,Flight reason,Note\n2006-13,,Dunedin / Momona (DUD/NZDN),Christchurch / Christchurch (CHC/NZCH),00:00:00,00:00:00,00:41:00,Air New Zealand (NZ/ANZ),ATR 72-200 (AT72),,,0,1,1,`;

    const result = await processFR24File(content, {
      filterOwner: false,
      airlineFromFlightNumber: true,
    });

    expect(result.flights).toHaveLength(0);
    expect(result.skippedRows).toBe(1);
  });

  it('skips day-precision FR24 dates that do not exist', async () => {
    const content = `Date,Flight number,From,To,Dep time,Arr time,Duration,Airline,Aircraft,Registration,Seat number,Seat type,Flight class,Flight reason,Note\n2006-02-30,,Dunedin / Momona (DUD/NZDN),Christchurch / Christchurch (CHC/NZCH),00:00:00,00:00:00,00:41:00,Air New Zealand (NZ/ANZ),ATR 72-200 (AT72),,,0,1,1,`;

    const result = await processFR24File(content, {
      filterOwner: false,
      airlineFromFlightNumber: true,
    });

    expect(result.flights).toHaveLength(0);
    expect(result.skippedRows).toBe(1);
  });

  it('skips dateless rows but keeps valid rows', async () => {
    const content = `Date,Flight number,From,To,Dep time,Arr time,Duration,Airline,Aircraft,Registration,Seat number,Seat type,Flight class,Flight reason,Note
2006-02-01,,Dunedin / Momona (DUD/NZDN),Christchurch / Christchurch (CHC/NZCH),00:00:00,00:00:00,00:41:00,Air New Zealand (NZ/ANZ),ATR 72-200 (AT72),,,0,1,1,
,,Dunedin / Momona (DUD/NZDN),Christchurch / Christchurch (CHC/NZCH),00:00:00,00:00:00,00:41:00,Air New Zealand (NZ/ANZ),ATR 72-200 (AT72),,,0,1,1,`;

    const result = await processFR24File(content, {
      filterOwner: false,
      airlineFromFlightNumber: true,
    });

    expect(result.flights).toHaveLength(1);
    expect(result.flights[0]?.date).toBe('2006-02-01');
    expect(result.skippedRows).toBe(1);
  });

  it('extracts ICAO from airports with digit-IATA placeholders like NA0', async () => {
    const content = `Date,Flight number,From,To,Dep time,Arr time,Duration,Airline,Aircraft,Registration,Seat number,Seat type,Flight class,Flight reason,Note\n2017-06-30,,Harle / Harle (NA0/EDXP),Wangerooge / Wangerooge (AGE/EDWG),09:00:00,09:10:00,00:10:00,Inselflieger (/LFH),Britten-Norman Islander (BN2P),D-ILFH,,1,1,1,`;

    const result = await processFR24File(content, {
      filterOwner: false,
      airlineFromFlightNumber: true,
    });

    expect(result.flights).toHaveLength(1);
    expect(getAirportByIcao).toHaveBeenCalledWith('EDXP');
    expect(getAirportByIcao).toHaveBeenCalledWith('EDWG');
    expect(result.skippedRows).toBe(0);
  });

  it('extracts ICAO from airlines with empty IATA like (/LFH)', async () => {
    const content = `Date,Flight number,From,To,Dep time,Arr time,Duration,Airline,Aircraft,Registration,Seat number,Seat type,Flight class,Flight reason,Note\n2017-06-30,,Harle / Harle (NA0/EDXP),Wangerooge / Wangerooge (AGE/EDWG),09:00:00,09:10:00,00:10:00,Inselflieger (/LFH),Britten-Norman Islander (BN2P),D-ILFH,,1,1,1,`;

    const result = await processFR24File(content, {
      filterOwner: false,
      airlineFromFlightNumber: true,
    });

    expect(result.flights).toHaveLength(1);
    expect(getAirlineByIcao).toHaveBeenCalledWith('LFH');
  });
});
