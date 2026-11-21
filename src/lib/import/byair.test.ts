import { beforeEach, describe, expect, it, vi } from 'vitest';

import { processByAirFile } from './byair';

const TIMEZONES: Record<string, string> = {
  HND: 'Asia/Tokyo',
  LAX: 'America/Los_Angeles',
  LHR: 'Europe/London',
  JFK: 'America/New_York',
};

const { getAirportByIata } = vi.hoisted(() => ({
  getAirportByIata: vi.fn(async (iata: string) => ({
    id: iata,
    iata,
    tz: TIMEZONES[iata] ?? 'UTC',
  })),
}));

vi.mock('$app/state', () => ({
  page: { data: { user: { id: 'user-1' } } },
}));

vi.mock('$lib/utils/data/airports/cache', () => ({ getAirportByIata }));

vi.mock('$lib/utils/data/airlines', () => ({
  getAirlineByIata: vi.fn(),
  getAirlineByIcao: vi.fn(),
}));

const COMMON_HEADERS = [
  'Flight Code',
  'Departure Airport Code',
  'Arrival Airport Code',
  'Booking Code',
  'Seat Number',
  'Seat Type',
  'Seat Class',
  'Purpose',
  'Notes',
  'Ownership',
  'byAir Flight ID',
  'byAir Codeshare ID',
];

const CURRENT_HEADERS = [
  ...COMMON_HEADERS,
  'Scheduled Departure',
  'Scheduled Arrival',
  'Actual Departure',
  'Actual Arrival',
];

const LEGACY_HEADERS = [
  ...COMMON_HEADERS,
  'Flight Date',
  'Departure Time',
  'Arrival Time',
];

const createByAirCsv = (
  headers: string[],
  from: string,
  to: string,
  times: string[],
) =>
  [
    headers.join(','),
    [
      ...['NH123', from, to, '', '4A', 'window', 'business', 'business'],
      ...['', 'mine', '', '', ...times],
    ].join(','),
  ].join('\n');

const options = {
  filterOwner: false,
  airlineFromFlightNumber: false,
  importMode: 'personal',
} as const;

const importSingle = async (csv: string) => {
  const result = await processByAirFile(csv, options);
  expect(result.skippedRows).toBe(0);
  expect(result.flights).toHaveLength(1);
  return result.flights[0];
};

describe('processByAirFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses scheduled times when there are no actual times', async () => {
    const flight = await importSingle(
      createByAirCsv(CURRENT_HEADERS, 'HND', 'LAX', [
        '2025-06-03 00:30',
        '2025-06-02 18:30',
        '',
        '',
      ]),
    );

    expect(flight).toMatchObject({
      date: '2025-06-03',
      departure: '2025-06-02T15:30:00.000+00:00',
      arrival: '2025-06-03T01:30:00.000+00:00',
      departureScheduled: '2025-06-02T15:30:00.000+00:00',
      arrivalScheduled: '2025-06-03T01:30:00.000+00:00',
      duration: 36000,
    });
  });

  it('prefers actual times and keeps the scheduled ones', async () => {
    const flight = await importSingle(
      createByAirCsv(CURRENT_HEADERS, 'LHR', 'JFK', [
        '2025-06-01 10:00',
        '2025-06-01 13:00',
        '2025-06-01 10:20',
        '2025-06-01 13:10',
      ]),
    );

    expect(flight).toMatchObject({
      departure: '2025-06-01T09:20:00.000+00:00',
      arrival: '2025-06-01T17:10:00.000+00:00',
      departureScheduled: '2025-06-01T09:00:00.000+00:00',
      arrivalScheduled: '2025-06-01T17:00:00.000+00:00',
      duration: 28200,
    });
  });

  it('falls back to the scheduled time per field', async () => {
    const flight = await importSingle(
      createByAirCsv(CURRENT_HEADERS, 'HND', 'LAX', [
        '2025-06-03 00:30',
        '2025-06-02 18:30',
        '2025-06-03 00:40',
        '',
      ]),
    );

    expect(flight).toMatchObject({
      departure: '2025-06-02T15:40:00.000+00:00',
      arrival: '2025-06-03T01:30:00.000+00:00',
      duration: 36000,
    });
  });

  it('drops a scheduled arrival that is before a delayed departure', async () => {
    const flight = await importSingle(
      createByAirCsv(CURRENT_HEADERS, 'LHR', 'LHR', [
        '2025-06-01 10:00',
        '2025-06-01 11:00',
        '2025-06-01 12:30',
        '',
      ]),
    );

    expect(flight).toMatchObject({
      departure: '2025-06-01T11:30:00.000+00:00',
      arrival: null,
      arrivalScheduled: '2025-06-01T10:00:00.000+00:00',
      duration: 3600,
    });
  });

  it('drops arrivals that are before their departure', async () => {
    const flight = await importSingle(
      createByAirCsv(CURRENT_HEADERS, 'LHR', 'LHR', [
        '2025-06-01 10:00',
        '2025-06-01 09:00',
        '2025-06-01 23:30',
        '2025-06-01 00:30',
      ]),
    );

    expect(flight).toMatchObject({
      arrival: null,
      arrivalScheduled: null,
      duration: null,
    });
  });

  it('accepts padded times with seconds and a missing scheduled arrival', async () => {
    const flight = await importSingle(
      createByAirCsv(CURRENT_HEADERS, 'LHR', 'JFK', [
        ' 2025-06-01 10:00:00 ',
        '',
        '',
        '',
      ]),
    );

    expect(flight).toMatchObject({
      departure: '2025-06-01T09:00:00.000+00:00',
      arrival: null,
      arrivalScheduled: null,
      duration: null,
    });
  });

  it('ignores columns it does not know', async () => {
    const csv = createByAirCsv([...LEGACY_HEADERS, 'Aircraft'], 'LHR', 'JFK', [
      '2025-06-01',
      '10:00',
      '13:00',
      'A320',
    ]);

    expect(await importSingle(csv)).toMatchObject({ duration: 28800 });
  });

  it('infers the arrival date for time-only exports', async () => {
    const flight = await importSingle(
      createByAirCsv(LEGACY_HEADERS, 'JFK', 'LHR', [
        '2025-06-07',
        '22:00',
        '10:00',
      ]),
    );

    expect(flight).toMatchObject({
      date: '2025-06-07',
      departure: '2025-06-08T02:00:00.000+00:00',
      arrival: '2025-06-08T09:00:00.000+00:00',
      departureScheduled: null,
      arrivalScheduled: null,
      duration: 25200,
    });
  });

  it('imports time-only exports without times', async () => {
    const flight = await importSingle(
      createByAirCsv(LEGACY_HEADERS, 'JFK', 'LHR', ['2025-06-07', '', '']),
    );

    expect(flight).toMatchObject({
      date: '2025-06-07',
      departure: null,
      arrival: null,
      duration: null,
    });
  });
});
