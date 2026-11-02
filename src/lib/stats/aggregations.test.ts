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
  extremeAirportsByLatitude,
  extremeFlightSpeeds,
  extremeFlights,
  flightMatchesChartBucket,
  flightTotals,
  extremeTimeZones,
  normalizeSeatNumber,
  punctualityReport,
  reasonDistribution,
  routeDistribution,
  routeLabelForFlight,
  seatNumberDistribution,
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

describe('seat numbers', () => {
  it('normalizes case and surrounding space', () => {
    expect(normalizeSeatNumber(' 12f ')).toBe('12F');
    expect(normalizeSeatNumber('2A')).toBe('2A');
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

  it('orders equal counts by row, then column', () => {
    const seats = ['12F', '2C', '10A', '2A', '3C'].map((seatNumber) => ({
      passengers: [{ userId: 'one', seatNumber }],
    })) as FlightData[];

    expect(
      Object.keys(seatNumberDistribution(seats, { userId: 'one' })),
    ).toEqual(['2A', '2C', '3C', '10A', '12F']);
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

describe('records', () => {
  const flight = (distance: number | null, duration: number | null) =>
    ({ distance, duration }) as FlightData;

  it('finds the longest and shortest by the chosen metric, skipping gaps', () => {
    const flights = [
      flight(1000, 3600),
      flight(null, 7200),
      flight(200, null),
      flight(5000, 900),
    ];

    expect(extremeFlights(flights, 'distance')).toEqual({
      longest: { flight: flights[3], value: 5000 },
      shortest: { flight: flights[2], value: 200 },
    });
    expect(extremeFlights(flights, 'duration')).toEqual({
      longest: { flight: flights[1], value: 7200 },
      shortest: { flight: flights[3], value: 900 },
    });
  });

  it('returns nothing without values to compare', () => {
    expect(extremeFlights([flight(null, null)], 'distance')).toEqual({
      longest: null,
      shortest: null,
    });
  });

  it('finds the fastest and slowest by ground speed, skipping half-recorded flights', () => {
    // 1000 km in 2h → 500 km/h; 500 km in 4h → 125 km/h
    const flights = [
      flight(1000, 7200),
      flight(500, 14400),
      flight(2000, null),
      flight(null, 3600),
    ];

    expect(extremeFlightSpeeds(flights)).toEqual({
      fastest: { flight: flights[0], value: 500 },
      slowest: { flight: flights[1], value: 125 },
    });
  });

  it('finds the northernmost and southernmost airport from both endpoints', () => {
    const airport = (iata: string, lat: number) => ({ iata, lat });
    const flights = [
      {
        from: airport('KEF', 64.13),
        to: airport('LHR', 51.47),
      },
      {
        from: airport('SIN', 1.36),
        to: airport('DOH', 25.27),
      },
    ] as unknown as FlightData[];

    expect(extremeAirportsByLatitude(flights)).toEqual({
      north: { airport: { iata: 'KEF', lat: 64.13 }, latitude: 64.13 },
      south: { airport: { iata: 'SIN', lat: 1.36 }, latitude: 1.36 },
    });
  });

  const zoneFlight = (fromTz: string, toTz: string, iso: string) =>
    ({
      from: { tz: fromTz },
      to: { tz: toTz },
      date: new Date(iso),
    }) as unknown as FlightData;

  it('finds the flight spanning the most time zones', () => {
    const short = zoneFlight(
      'Europe/Copenhagen',
      'Europe/Berlin',
      '2026-06-01T10:00:00Z',
    );
    const long = zoneFlight(
      'Europe/Copenhagen',
      'America/Los_Angeles',
      '2026-06-01T10:00:00Z',
    );

    expect(extremeTimeZones([short, long])).toEqual({
      flight: long,
      zones: 9,
    });
  });

  it('accounts for daylight saving at flight time', () => {
    const summer = zoneFlight(
      'Asia/Kolkata',
      'Europe/London',
      '2026-07-01T10:00:00Z',
    );
    const winter = zoneFlight(
      'Asia/Kolkata',
      'Europe/London',
      '2026-01-01T10:00:00Z',
    );

    expect(extremeTimeZones([summer])).toEqual({ flight: summer, zones: 4.5 });
    expect(extremeTimeZones([winter])).toEqual({ flight: winter, zones: 5.5 });
  });

  it('skips flights without both time zones and returns nothing', () => {
    expect(extremeTimeZones([])).toBeNull();
    expect(
      extremeTimeZones([
        zoneFlight('Europe/Copenhagen', '', '2026-06-01T10:00:00Z'),
      ]),
    ).toBeNull();
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

  it('totals time gained by early arrivals, with the best one', () => {
    const earlyTwice = [
      makeFlight({
        arrivalScheduled: '2024-01-01T10:00:00Z',
        arrival: '2024-01-01T09:45:00Z', // 15 early
      }),
      makeFlight({
        arrivalScheduled: '2024-01-02T10:00:00Z',
        arrival: '2024-01-02T09:50:00Z', // 10 early
      }),
    ];

    const report = punctualityReport(earlyTwice);
    expect(report.earlyFlights).toBe(2);
    expect(report.totalEarlyMinutes).toBe(25);
    expect(report.bestEarlyMinutes).toBe(15);
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

    const report = punctualityReport(flights, { groupLimit: 1 });
    expect(report.worstAirlines).toHaveLength(1);
    expect(report.worstAirlines[0]).toMatchObject({
      key: 'Beta',
      totalDelayMinutes: 120,
      delayedFlights: 1,
      assessedFlights: 1,
    });

    const full = punctualityReport(flights);
    expect(full.worstAirlines.map((a) => a.key)).toEqual(['Beta', 'Alpha']);
    const alpha = full.worstAirlines.find((a) => a.key === 'Alpha')!;
    expect(alpha.delayRate).toBeCloseTo(50); // 1 of 2 Alpha flights delayed
  });

  it('groups delays by route and departing airport too', () => {
    const flights = [
      {
        ...makeFlight({
          arrivalScheduled: '2024-01-01T10:00:00Z',
          arrival: '2024-01-01T10:30:00Z', // +30
        }),
        from: { iata: 'CPH' },
        to: { iata: 'LHR' },
      },
      {
        ...makeFlight({
          arrivalScheduled: '2024-01-02T10:00:00Z',
          arrival: '2024-01-02T11:00:00Z', // +60
        }),
        from: { iata: 'ARN' },
        to: { iata: 'LHR' },
      },
    ] as unknown as FlightData[];

    const report = punctualityReport(flights);
    expect(report.worstRoutes.map((r) => r.key)).toEqual([
      'ARN – LHR',
      'CPH – LHR',
    ]);
    expect(report.worstRoutes[0]).toMatchObject({
      totalDelayMinutes: 60,
      delayedFlights: 1,
    });
    expect(report.worstDepartureAirports.map((a) => a.key)).toEqual([
      'ARN',
      'CPH',
    ]);
  });

  it('lists the individually most-delayed flights, most late first', () => {
    const flights = [
      makeFlight({
        arrivalScheduled: '2024-01-01T10:00:00Z',
        arrival: '2024-01-01T10:20:00Z', // +20
      }),
      makeFlight({
        arrivalScheduled: '2024-01-02T10:00:00Z',
        arrival: '2024-01-02T09:50:00Z', // −10
      }),
      makeFlight({
        arrivalScheduled: '2024-01-03T10:00:00Z',
        arrival: '2024-01-03T11:00:00Z', // +60
      }),
    ];

    const report = punctualityReport(flights);
    expect(report.worstDelays.map((d) => Math.round(d.delayMinutes))).toEqual([
      60, 20, -10,
    ]);
  });
});
