import { TZDate } from '@date-fns/tz';
import { describe, expect, it } from 'vitest';

import { COUNTRIES } from '$lib/data/countries';
import {
  arrivalDelayMinutes,
  countFlightsPerYear,
  countriesByContinentDetails,
  countriesByContinentDistribution,
  countryDistribution,
  DELAY_THRESHOLD_MINUTES,
  flightMatchesChartBucket,
  normalizeSeatNumber,
  punctualityReport,
  reasonDistribution,
  routeDistribution,
  routeLabelForFlight,
  seatNumberDistribution,
  toBreakdown,
} from './aggregations';
import type { FlightData } from '$lib/utils';

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
  it('counts removed custom reasons with their original labels and filters by passenger', () => {
    const customFlights = [
      {
        passengers: [
          { userId: 'one', flightReason: 'Study abroad' },
          { userId: 'two', flightReason: 'VIP' },
        ],
      },
      { passengers: [{ userId: 'one', flightReason: null }] },
    ] as FlightData[];
    expect(reasonDistribution(customFlights, { userId: 'one' })).toMatchObject({
      'Study abroad': 1,
      'No Data': 1,
    });
    expect(
      reasonDistribution(customFlights, { userId: 'one' }),
    ).not.toHaveProperty('VIP');
    expect(reasonDistribution(customFlights, {})).toMatchObject({
      'Study abroad': 1,
      VIP: 1,
      'No Data': 1,
    });
    expect(
      flightMatchesChartBucket(customFlights[0]!, 'reason', 'Study abroad', {
        userId: 'one',
      }),
    ).toBe(true);
    expect(
      flightMatchesChartBucket(customFlights[0]!, 'reason', 'VIP', {
        userId: 'one',
      }),
    ).toBe(false);
  });
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

describe('flights per year statistics', () => {
  const flightOn = (date: TZDate | null) => ({ date }) as FlightData;
  // Date parts are read in the given zone, so the host zone can't move a
  // flight into another year
  const at = (
    year: number,
    month: number,
    day: number,
    hour = 12,
    zone = 'UTC',
  ) => new TZDate(year, month - 1, day, hour, 0, zone);

  it('counts flights per year and fills years without flights', () => {
    const flights = [
      flightOn(at(2021, 3, 1)),
      flightOn(at(2024, 7, 15)),
      flightOn(at(2021, 12, 31, 23)),
      flightOn(at(2023, 1, 1, 0)),
    ];

    expect(countFlightsPerYear(flights)).toEqual([
      { year: 2021, flights: 2 },
      { year: 2022, flights: 0 },
      { year: 2023, flights: 1 },
      { year: 2024, flights: 1 },
    ]);
  });

  it('uses the year in the flight date time zone', () => {
    const newYearsEveInLosAngeles = at(2019, 12, 31, 22, 'America/Los_Angeles');

    expect(countFlightsPerYear([flightOn(newYearsEveInLosAngeles)])).toEqual([
      { year: 2019, flights: 1 },
    ]);
  });

  it('skips flights without a date', () => {
    expect(
      countFlightsPerYear([flightOn(null), flightOn(at(2020, 5, 5))]),
    ).toEqual([{ year: 2020, flights: 1 }]);
  });

  it('skips flights whose date does not parse', () => {
    const unparsed = new TZDate(Number.NaN, 'UTC');

    expect(
      countFlightsPerYear([flightOn(unparsed), flightOn(at(2020, 5, 5))]),
    ).toEqual([{ year: 2020, flights: 1 }]);
  });

  it('returns no years when no flight has a date', () => {
    expect(countFlightsPerYear([flightOn(null)])).toEqual([]);
  });
});

describe('routes', () => {
  const flight = (from: string, to: string) =>
    ({ from: { iata: from }, to: { iata: to } }) as unknown as FlightData;

  it('counts an outbound flight and its return as one route', () => {
    expect(
      routeDistribution([flight('LHR', 'CPH'), flight('CPH', 'LHR')], {}),
    ).toEqual({ 'CPH – LHR': 2 });
  });

  it('matches both directions to the same bucket', () => {
    const inbound = flight('LHR', 'CPH');
    expect(routeLabelForFlight(inbound)).toBe('CPH – LHR');
    expect(flightMatchesChartBucket(inbound, 'routes', 'CPH – LHR')).toBe(true);
  });
});

describe('flight country statistics', () => {
  const flights = [
    {
      from: { iata: 'DUB', country: 'IE' },
      to: { iata: 'SCQ', country: 'ES' },
    },
    {
      from: { iata: 'SCQ', country: 'ES' },
      to: { iata: 'DUB', country: 'IE' },
    },
    {
      from: { iata: 'MAD', country: 'es' },
      to: { iata: 'BCN', country: 'ES' },
    },
    {
      from: { iata: 'DUB', country: 'IE' },
      to: { iata: 'BOS', country: 'US' },
    },
  ] as FlightData[];

  it('counts each country once per flight, keyed by uppercase code', () => {
    expect(countryDistribution(flights, {})).toEqual({
      ES: 3,
      IE: 3,
      US: 1,
    });
  });

  it('matches flights touching a country bucket', () => {
    expect(flightMatchesChartBucket(flights[0]!, 'countries', 'ES', {})).toBe(
      true,
    );
    expect(flightMatchesChartBucket(flights[0]!, 'countries', 'US', {})).toBe(
      false,
    );
    expect(flightMatchesChartBucket(flights[2]!, 'countries', 'ES', {})).toBe(
      true,
    );
  });
});

describe('seat numbers', () => {
  it('normalizes case and surrounding space', () => {
    expect(normalizeSeatNumber(' 12f ')).toBe('12F');
    expect(normalizeSeatNumber('2A')).toBe('2A');
    expect(normalizeSeatNumber('07c')).toBe('7C');
    expect(normalizeSeatNumber('row 12')).toBeNull();
    expect(normalizeSeatNumber('')).toBeNull();
    expect(normalizeSeatNumber(null)).toBeNull();
  });

  const flights = [
    {
      passengers: [
        { userId: 'one', seatNumber: '12f', seat: 'window' },
        { userId: 'two', seatNumber: '3C', seat: 'aisle' },
      ],
    },
    {
      passengers: [{ userId: 'one', seatNumber: '3c' }],
    },
  ] as FlightData[];

  it('counts only the scoped passenger, not every passenger', () => {
    expect(seatNumberDistribution(flights, { userId: 'one' })).toEqual({
      '3C': 1,
      '12F': 1,
    });
    expect(seatNumberDistribution(flights, { userId: 'two' })).toEqual({
      '3C': 1,
    });
  });

  it('counts every passenger when unscoped', () => {
    expect(seatNumberDistribution(flights, {})).toEqual({
      '3C': 2,
      '12F': 1,
    });
  });

  it('ranks by count, then orders equal counts by row and column', () => {
    const seats = ['12F', '2C', '10A', '2A', '3C', '12F'].map((seatNumber) => ({
      passengers: [{ userId: 'one', seatNumber }],
    })) as FlightData[];

    expect(
      Object.keys(seatNumberDistribution(seats, { userId: 'one' })),
    ).toEqual(['12F', '2A', '2C', '3C', '10A']);
  });

  it('matches a flight through the scoped passenger only', () => {
    expect(
      flightMatchesChartBucket(flights[0]!, 'seat-numbers', '12F', {
        userId: 'one',
      }),
    ).toBe(true);
    expect(
      flightMatchesChartBucket(flights[0]!, 'seat-numbers', '12F', {
        userId: 'two',
      }),
    ).toBe(false);
    expect(
      flightMatchesChartBucket(flights[1]!, 'seat-numbers', '3C', {
        userId: 'two',
      }),
    ).toBe(false);
  });
});

describe('toBreakdown', () => {
  it('ranks entries and keeps "No Data" apart', () => {
    expect(
      toBreakdown({ Aisle: 2, 'No Data': 3, Window: 5, Middle: 0 }),
    ).toEqual({
      entries: [
        { key: 'Window', value: 5 },
        { key: 'Aisle', value: 2 },
      ],
      missing: 3,
    });
  });
});

const makeFlight = ({
  arrivalScheduled = null,
  arrival = null,
  airline = null,
}: {
  arrivalScheduled?: string | null;
  arrival?: string | null;
  airline?: { name: string } | null;
} = {}) =>
  ({ airline, raw: { arrivalScheduled, arrival } }) as unknown as FlightData;

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
  it('counts a delay just over the threshold as delayed', () => {
    const report = punctualityReport([
      makeFlight({
        arrivalScheduled: '2024-01-01T10:00:00Z',
        arrival: '2024-01-01T10:15:30Z',
      }),
    ]);
    expect(report.delayedFlights).toBe(1);
  });

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
