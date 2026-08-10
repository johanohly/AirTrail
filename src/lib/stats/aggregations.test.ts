import { describe, expect, it, vi } from 'vitest';

import { COUNTRIES } from '$lib/data/countries';
import {
  aircraftReport,
  arrivalDelayMinutes,
  countriesByContinentDetails,
  countriesByContinentDistribution,
  DELAY_THRESHOLD_MINUTES,
  flightMatchesChartBucket,
  punctualityReport,
  reasonDistribution,
} from './aggregations';

import type { FlightData } from '$lib/utils';

vi.mock('$app/state', () => ({
  page: { data: { user: null } },
}));

type FlightSeed = {
  aircraft?: { name: string } | null;
  aircraftReg?: string | null;
  airline?: { name: string } | null;
  passengers?: {
    seat?: string;
    seatClass?: string;
    flightReason?: string | null;
    userId?: string | null;
  }[];
  arrivalScheduled?: string | null;
  arrival?: string | null;
};

// Build a FlightData stub carrying only the fields the report aggregations read.
const makeFlight = (seed: FlightSeed = {}): FlightData => {
  const {
    arrivalScheduled = null,
    arrival = null,
    passengers = [],
    ...rest
  } = seed;
  return {
    aircraft: null,
    aircraftReg: null,
    airline: null,
    ...rest,
    passengers,
    raw: { arrivalScheduled, arrival },
  } as unknown as FlightData;
};

describe('country statistics', () => {
  const visitedKosovo = [
    { code: 'XK', status: 'visited', note: null },
  ] as const;

  it('counts Kosovo as a visited European country', () => {
    const result = countriesByContinentDistribution([...visitedKosovo]);
    const europeanCountries = COUNTRIES.filter(
      (country) => country.continent === 'Europe',
    );

    expect(result.Europe).toEqual({
      visited: 1,
      total: europeanCountries.length,
    });
  });

  it('includes Kosovo in country details', () => {
    const result = countriesByContinentDetails([...visitedKosovo]);
    const kosovo = result.Europe?.find((country) => country.code === 'XK');

    expect(kosovo).toMatchObject({
      name: 'Kosovo',
      visited: true,
    });
  });
});

describe('passenger reason statistics', () => {
  const flights = [
    {
      passengers: [
        { userId: 'one', flightReason: 'business' },
        { userId: 'two', flightReason: 'leisure' },
      ],
    },
    {
      passengers: [
        { userId: 'one', flightReason: null },
        { userId: 'two', flightReason: 'leisure' },
      ],
    },
  ] as FlightData[];

  it('counts each passenger when aggregating all users', () => {
    expect(reasonDistribution(flights, {})).toMatchObject({
      Leisure: 2,
      Business: 1,
      'No Data': 1,
    });
  });

  it('counts only the selected passenger', () => {
    expect(reasonDistribution(flights, { userId: 'one' })).toMatchObject({
      Business: 1,
      'No Data': 1,
    });
    expect(
      flightMatchesChartBucket(flights[0]!, 'reason', 'Business', {
        userId: 'one',
      }),
    ).toBe(true);
    expect(
      flightMatchesChartBucket(flights[0]!, 'reason', 'Leisure', {
        userId: 'one',
      }),
    ).toBe(false);
  });
});

describe('arrivalDelayMinutes', () => {
  it('returns null when scheduled or actual arrival is missing', () => {
    expect(arrivalDelayMinutes(makeFlight())).toBeNull();
    expect(
      arrivalDelayMinutes(
        makeFlight({ arrivalScheduled: '2024-01-01T10:00:00Z' }),
      ),
    ).toBeNull();
  });

  it('returns null for unparseable timestamps', () => {
    expect(
      arrivalDelayMinutes(
        makeFlight({ arrivalScheduled: 'not-a-date', arrival: 'nope' }),
      ),
    ).toBeNull();
  });

  it('computes signed minutes between actual and scheduled', () => {
    expect(
      arrivalDelayMinutes(
        makeFlight({
          arrivalScheduled: '2024-01-01T10:00:00Z',
          arrival: '2024-01-01T10:25:00Z',
        }),
      ),
    ).toBe(25);
    expect(
      arrivalDelayMinutes(
        makeFlight({
          arrivalScheduled: '2024-01-01T10:00:00Z',
          arrival: '2024-01-01T09:50:00Z',
        }),
      ),
    ).toBe(-10);
  });
});

describe('punctualityReport', () => {
  it('reports nothing when no flight has scheduled/actual times', () => {
    const report = punctualityReport([makeFlight(), makeFlight()]);
    expect(report.assessedFlights).toBe(0);
    expect(report.delayedFlights).toBe(0);
    expect(report.delayRate).toBe(0);
    expect(report.worstAirlines).toEqual([]);
  });

  it('only counts delays beyond the threshold and ignores early/on-time', () => {
    const onTime = makeFlight({
      arrivalScheduled: '2024-01-01T10:00:00Z',
      arrival: `2024-01-01T10:${String(DELAY_THRESHOLD_MINUTES).padStart(2, '0')}:00Z`, // exactly at threshold → not delayed
    });
    const early = makeFlight({
      arrivalScheduled: '2024-01-01T10:00:00Z',
      arrival: '2024-01-01T09:45:00Z',
    });
    const delayed = makeFlight({
      arrivalScheduled: '2024-01-01T10:00:00Z',
      arrival: '2024-01-01T10:40:00Z', // 40 min late
    });

    const report = punctualityReport([onTime, early, delayed]);
    expect(report.assessedFlights).toBe(3);
    expect(report.delayedFlights).toBe(1);
    expect(report.totalDelayMinutes).toBe(40);
    expect(report.worstDelayMinutes).toBe(40);
    expect(report.delayRate).toBeCloseTo((1 / 3) * 100);
  });

  it('ranks worst airlines by accumulated delay and respects the limit', () => {
    const flights = [
      makeFlight({
        airline: { name: 'Alpha' },
        arrivalScheduled: '2024-01-01T10:00:00Z',
        arrival: '2024-01-01T10:30:00Z', // +30
      }),
      makeFlight({
        airline: { name: 'Alpha' },
        arrivalScheduled: '2024-01-01T10:00:00Z',
        arrival: '2024-01-01T10:05:00Z', // on time
      }),
      makeFlight({
        airline: { name: 'Beta' },
        arrivalScheduled: '2024-01-01T10:00:00Z',
        arrival: '2024-01-01T12:00:00Z', // +120
      }),
    ];

    const report = punctualityReport(flights, { worstAirlineLimit: 1 });
    expect(report.worstAirlines).toHaveLength(1);
    expect(report.worstAirlines[0]).toMatchObject({
      airline: 'Beta',
      totalDelayMinutes: 120,
      delayedFlights: 1,
      assessedFlights: 1,
    });

    const full = punctualityReport(flights);
    expect(full.worstAirlines.map((a) => a.airline)).toEqual(['Beta', 'Alpha']);
    const alpha = full.worstAirlines.find((a) => a.airline === 'Alpha')!;
    expect(alpha.delayRate).toBeCloseTo(50); // 1 of 2 Alpha flights delayed
  });
});

describe('aircraftReport', () => {
  it('counts distinct aircraft types and surfaces the most flown', () => {
    const flights = [
      makeFlight({ aircraft: { name: 'A320' }, aircraftReg: 'D-AIZA' }),
      makeFlight({ aircraft: { name: 'A320' }, aircraftReg: 'D-AIZB' }),
      makeFlight({ aircraft: { name: 'B738' }, aircraftReg: 'D-AIZA' }),
      makeFlight({ aircraft: null, aircraftReg: null }),
    ];

    const report = aircraftReport(flights, {});
    expect(report.typeCount).toBe(2);
    expect(report.mostFlownType).toEqual({ label: 'A320', count: 2 });
    expect(report.mostFlownTail).toEqual({ label: 'D-AIZA', count: 2 });
  });

  it('ignores the "No Data" bucket so empty fields never win', () => {
    const flights = [
      makeFlight({ aircraft: null, aircraftReg: null }),
      makeFlight({ aircraft: null, aircraftReg: null }),
      makeFlight({ aircraft: { name: 'A320' }, aircraftReg: 'D-AIZA' }),
    ];

    const report = aircraftReport(flights, {});
    expect(report.mostFlownType).toEqual({ label: 'A320', count: 1 });
    expect(report.mostFlownTail).toEqual({ label: 'D-AIZA', count: 1 });
  });

  it('returns null entries when there is nothing to rank', () => {
    const report = aircraftReport([], {});
    expect(report.typeCount).toBe(0);
    expect(report.mostFlownType).toBeNull();
    expect(report.topSeatClass).toBeNull();
  });

  it('picks the top seat class across all passengers when no user is scoped', () => {
    const flights = [
      makeFlight({ passengers: [{ seatClass: 'economy' }] }),
      makeFlight({ passengers: [{ seatClass: 'economy' }] }),
      makeFlight({ passengers: [{ seatClass: 'business' }] }),
    ];

    const report = aircraftReport(flights, {});
    expect(report.topSeatClass).toEqual({ label: 'Economy', count: 2 });
  });
});
