import { describe, expect, it } from 'vitest';

import {
  distanceRecords,
  durationRecords,
  latitudeRecords,
  speedRecords,
  timeZoneRecord,
} from './records';
import type { FlightData } from '$lib/utils';

const flight = (
  distance: number | null,
  duration: number | null,
  recorded = true,
) =>
  ({
    distance,
    duration,
    departure: recorded ? new Date('2026-06-01T08:00:00Z') : null,
    arrival: recorded ? new Date('2026-06-01T12:00:00Z') : null,
  }) as FlightData;

describe('distance and duration records', () => {
  it('finds the highest and lowest, skipping missing values', () => {
    const flights = [
      flight(1000, 3600),
      flight(null, 7200),
      flight(200, null),
      flight(5000, 900),
    ];

    expect(distanceRecords(flights)).toEqual({
      highest: { flight: flights[3], value: 5000 },
      lowest: { flight: flights[2], value: 200 },
    });
    expect(durationRecords(flights)).toEqual({
      highest: { flight: flights[1], value: 7200 },
      lowest: { flight: flights[3], value: 900 },
    });
  });

  it('leaves a flight back to its own airport out of the shortest route', () => {
    const flights = [flight(0, 1800), flight(350, 3600)];

    expect(distanceRecords(flights).lowest).toEqual({
      flight: flights[1],
      value: 350,
    });
  });

  it('returns nothing without values to compare', () => {
    expect(distanceRecords([flight(null, null)])).toEqual({
      highest: null,
      lowest: null,
    });
  });
});

describe('speed records', () => {
  it('ranks by ground speed, skipping flights missing a value', () => {
    // 1000 km in 2h is 500 km/h; 500 km in 4h is 125 km/h.
    const flights = [
      flight(1000, 7200),
      flight(500, 14400),
      flight(2000, null),
      flight(null, 3600),
    ];

    expect(speedRecords(flights)).toEqual({
      highest: { flight: flights[0], value: 500 },
      lowest: { flight: flights[1], value: 125 },
    });
  });

  it('skips flights whose duration is estimated', () => {
    const recorded = flight(1000, 7200);
    const estimated = flight(3000, 3600, false);

    expect(speedRecords([recorded, estimated])).toEqual({
      highest: { flight: recorded, value: 500 },
      lowest: { flight: recorded, value: 500 },
    });
    expect(speedRecords([estimated])).toEqual({
      highest: null,
      lowest: null,
    });
  });
});

describe('latitude records', () => {
  it('finds the northernmost and southernmost airport from both endpoints', () => {
    const kef = { iata: 'KEF', lat: 64.13 };
    const sin = { iata: 'SIN', lat: 1.36 };
    const flights = [
      { from: kef, to: { iata: 'LHR', lat: 51.47 } },
      { from: sin, to: { iata: 'DOH', lat: 25.27 } },
    ] as unknown as FlightData[];

    expect(latitudeRecords(flights)).toEqual({ north: kef, south: sin });
  });
});

describe('time zone record', () => {
  const zoneFlight = (fromTz: string, toTz: string, iso: string) =>
    ({
      from: { tz: fromTz },
      to: { tz: toTz },
      date: new Date(iso),
    }) as unknown as FlightData;

  it('finds the flight spanning the most time zones', () => {
    const short = zoneFlight(
      'Europe/Copenhagen',
      'Europe/London',
      '2026-06-01T10:00:00Z',
    );
    const long = zoneFlight(
      'Europe/Copenhagen',
      'America/Los_Angeles',
      '2026-06-01T10:00:00Z',
    );

    expect(timeZoneRecord([short, long])).toEqual({ flight: long, value: 9 });
  });

  it('takes the short way round across the date line', () => {
    const transpacific = zoneFlight(
      'Asia/Tokyo',
      'Pacific/Honolulu',
      '2026-06-01T10:00:00Z',
    );

    expect(timeZoneRecord([transpacific])?.value).toBe(5);
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

    expect(timeZoneRecord([summer])?.value).toBe(4.5);
    expect(timeZoneRecord([winter])?.value).toBe(5.5);
  });

  it('counts no zone for a domestic flight across a changeover month', () => {
    // Logged by month: the period starts in winter time and ends in summer.
    const march = {
      from: { tz: 'Europe/Berlin' },
      to: { tz: 'Europe/Berlin' },
      date: new Date('2025-03-01T00:00:00Z'),
      dateEnd: new Date('2025-03-31T23:59:59Z'),
    } as unknown as FlightData;

    expect(timeZoneRecord([march])).toBeNull();
  });

  it('returns nothing when no flight leaves its time zone', () => {
    expect(timeZoneRecord([])).toBeNull();
    expect(
      timeZoneRecord([
        zoneFlight('Europe/Copenhagen', 'Europe/Berlin', '2026-06-01T10:00Z'),
        zoneFlight('Europe/Copenhagen', '', '2026-06-01T10:00:00Z'),
      ]),
    ).toBeNull();
  });
});
