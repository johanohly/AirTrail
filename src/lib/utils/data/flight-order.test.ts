import { describe, expect, it } from 'vitest';

import {
  hasDepartureTime,
  listMoveOptions,
  orderNewestFirst,
  planMove,
} from './flight-order';

import type { Airport, Flight } from '$lib/db/types';

const LHR = { id: 1, tz: 'Europe/London' } as Airport;
const ORD = { id: 2, tz: 'America/Chicago' } as Airport;

const flight = (
  id: number,
  date: string,
  overrides: Partial<Flight> = {},
): Flight =>
  ({
    id,
    date,
    datePrecision: 'month',
    sortKey: null,
    from: LHR,
    to: ORD,
    departure: null,
    arrival: null,
    departureScheduled: null,
    arrivalScheduled: null,
    takeoffScheduled: null,
    takeoffActual: null,
    landingScheduled: null,
    landingActual: null,
    duration: null,
    ...overrides,
  }) as Flight;

const ids = (flights: Flight[]) =>
  orderNewestFirst(flights, (f) => f).map((f) => f.id);

describe('hasDepartureTime', () => {
  it('ignores a departure recorded on a flight known only to the month', () => {
    expect(
      hasDepartureTime(
        flight(1, '1998-07-01', { departure: '1998-07-01T00:00:00.000Z' }),
      ),
    ).toBe(false);
  });

  it('counts a scheduled departure at any precision', () => {
    expect(
      hasDepartureTime(
        flight(1, '1998-07-01', {
          departureScheduled: '1998-07-04T10:00:00.000Z',
        }),
      ),
    ).toBe(true);
  });
});

describe('orderNewestFirst', () => {
  it('orders a bucket on sort key before id', () => {
    const moved = flight(1, '1998-07-01', { sortKey: 2.5 });

    expect(
      ids([flight(2, '1998-07-01'), moved, flight(3, '1998-07-01')]),
    ).toEqual([3, 1, 2]);
  });

  it('keeps a bucket together when a day shares its first day', () => {
    const firstOfJuly = flight(2, '1998-07-01', { datePrecision: 'day' });

    expect(
      ids([flight(1, '1998-07-01'), firstOfJuly, flight(3, '1998-07-01')]),
    ).toEqual([3, 1, 2]);
  });
  it('keeps a bucket from different timezones together around a timed flight', () => {
    const UTC = { id: 3, tz: 'UTC' } as Airport;
    const fromLondon = flight(1, '1998-07-01', { from: LHR });
    const fromChicago = flight(2, '1998-07-01', { from: ORD });
    const early = flight(3, '1998-07-01', {
      from: UTC,
      datePrecision: 'day',
      departure: '1998-07-01T02:00:00.000Z',
    });

    expect(ids([fromLondon, early, fromChicago])).toEqual([2, 1, 3]);
  });
});

describe('listMoveOptions', () => {
  it('offers moves only within a bucket', () => {
    const ordered = [
      flight(3, '1998-08-01'),
      flight(2, '1998-07-01'),
      flight(4, '1998-07-01', { datePrecision: 'day' }),
      flight(1, '1998-07-01'),
    ];

    expect(Object.fromEntries(listMoveOptions(ordered))).toEqual({
      2: { later: false, earlier: true },
      1: { later: true, earlier: false },
    });
  });

  it('leaves out flights with a time', () => {
    const timed = { departure: '1998-07-01T10:00:00.000Z' };
    const ordered = [
      flight(2, '1998-07-01', { datePrecision: 'day', ...timed }),
      flight(1, '1998-07-01', { datePrecision: 'day', ...timed }),
    ];

    expect(listMoveOptions(ordered).size).toBe(0);
  });
});

describe('planMove', () => {
  const bucket = [
    { id: 4, sortKey: null },
    { id: 3, sortKey: null },
    { id: 2, sortKey: null },
    { id: 1, sortKey: null },
  ];

  it('moves between the neighbour and the flight beyond', () => {
    expect(planMove(bucket, 4, 'earlier')).toEqual(new Map([[4, 2.5]]));
    expect(planMove(bucket, 1, 'later')).toEqual(new Map([[1, 2.5]]));
  });

  it('moves one past the neighbour at either end', () => {
    expect(planMove(bucket, 2, 'earlier')).toEqual(new Map([[2, 0]]));
    expect(planMove(bucket, 3, 'later')).toEqual(new Map([[3, 5]]));
  });

  it('refuses a move past the end of the bucket', () => {
    expect(planMove(bucket, 1, 'earlier')).toBeNull();
    expect(planMove(bucket, 4, 'later')).toBeNull();
    expect(planMove(bucket, 9, 'later')).toBeNull();
  });

  it('renumbers the bucket when the gap is used up', () => {
    const crowded = [
      { id: 7, sortKey: null },
      { id: 5, sortKey: 3 + 1e-7 },
      { id: 6, sortKey: 3 },
      { id: 1, sortKey: null },
    ];

    expect(planMove(crowded, 7, 'earlier')).toEqual(
      new Map([
        [5, 4],
        [7, 3],
        [6, 2],
        [1, 1],
      ]),
    );
  });
});
