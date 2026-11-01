import { TZDate } from '@date-fns/tz';
import { describe, expect, it } from 'vitest';

import { COUNTRIES } from '$lib/data/countries';
import {
  arrivalDelayMinutes,
  autopilotRatio,
  countFlightsPerYear,
  countriesByContinentDetails,
  countriesByContinentDistribution,
  countryDistribution,
  DELAY_THRESHOLD_MINUTES,
  domesticInternationalSplit,
  flightMatchesChartBucket,
  flightTotals,
  punctualityReport,
  reasonDistribution,
  routeDistribution,
  routeLabelForFlight,
  toBreakdown,
  travelDayCount,
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

  it('counts both endpoints per flight, keyed by uppercase code', () => {
    expect(countryDistribution(flights, {})).toEqual({
      ES: 4,
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

  it('splits domestic and international flights, case-insensitively', () => {
    expect(domesticInternationalSplit(flights)).toEqual({
      domestic: 1,
      international: 3,
    });
  });

  it('totals unique airlines, aircraft, routes and countries', () => {
    const detailed = [
      {
        from: { iata: 'DUB', country: 'IE' },
        to: { iata: 'SCQ', country: 'ES' },
        airline: { name: 'Ryanair' },
        aircraft: { name: 'Boeing 737-800' },
      },
      {
        from: { iata: 'SCQ', country: 'ES' },
        to: { iata: 'DUB', country: 'IE' },
        airline: { name: 'Ryanair' },
        aircraft: { name: 'Airbus A320' },
      },
    ] as FlightData[];

    // Both legs share the undirected DUB – SCQ route
    expect(flightTotals(detailed)).toEqual({
      airlines: 1,
      aircraftModels: 2,
      routes: 1,
      countries: 2,
    });
  });
});

describe('travel days', () => {
  it('counts unique calendar days of departure', () => {
    const flights = [
      { date: new Date(2026, 0, 2, 8) },
      { date: new Date(2026, 0, 2, 20) },
      { date: new Date(2026, 0, 5, 9, 30) },
      { date: null },
    ] as FlightData[];

    expect(travelDayCount(flights)).toBe(2);
  });
});

describe('autopilot ratio', () => {
  const flights = [
    {
      passengers: [
        { userId: 'one', seat: 'window' },
        { userId: 'two', seat: 'pilot' },
      ],
    },
    {
      passengers: [{ userId: 'one', seat: null }],
    },
  ] as FlightData[];

  it('returns null without flights', () => {
    expect(autopilotRatio([], {})).toBeNull();
  });

  it('is the share of flights flown as pilot or copilot', () => {
    expect(autopilotRatio(flights, { userId: 'two' })).toBe(1);
    expect(autopilotRatio(flights, { userId: 'one' })).toBe(0);
    expect(autopilotRatio(flights, {})).toBe(0.5);
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
