import { describe, expect, it } from 'vitest';

import {
  arrivalDelayMinutes,
  byAverageDelay,
  DELAY_THRESHOLD_MINUTES,
  formatSignedDelay,
  punctualityReport,
} from './punctuality';
import type { FlightData } from '$lib/utils';

let nextId = 1;

const makeFlight = ({
  arrivalScheduled = null,
  arrival = null,
  airline = null,
  from = null,
  to = null,
  date = '2024-01-01',
  sortKey = null,
}: {
  arrivalScheduled?: string | null;
  arrival?: string | null;
  airline?: { name: string } | null;
  from?: string | null;
  to?: string | null;
  date?: string;
  sortKey?: number | null;
} = {}) => {
  const id = nextId++;
  return {
    id,
    airline,
    from: from ? { iata: from } : null,
    to: to ? { iata: to } : null,
    raw: { id, date, datePrecision: 'day', sortKey, arrivalScheduled, arrival },
  } as unknown as FlightData;
};

/** A flight scheduled to land at 10:00 that landed `minutes` late. */
const landed = (
  minutes: number,
  extra: Parameters<typeof makeFlight>[0] = {},
) =>
  makeFlight({
    arrivalScheduled: '2024-01-01T10:00:00Z',
    arrival: new Date(
      Date.parse('2024-01-01T10:00:00Z') + minutes * 60_000,
    ).toISOString(),
    ...extra,
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
    expect(arrivalDelayMinutes(landed(25))).toBe(25);
    expect(arrivalDelayMinutes(landed(-10))).toBe(-10);
  });
});

describe('punctualityReport', () => {
  it('counts a delay just over the threshold as delayed', () => {
    expect(punctualityReport([landed(15.5)]).delayedFlights).toBe(1);
  });

  it('reports nothing when no flight has scheduled/actual times', () => {
    const report = punctualityReport([makeFlight(), makeFlight()]);
    expect(report.assessedFlights).toBe(0);
    expect(report.delayedFlights).toBe(0);
    expect(report.delayRate).toBe(0);
    expect(report.groups.airlines).toEqual([]);
    expect(report.delays).toEqual([]);
  });

  it('only counts delays beyond the threshold and ignores early/on-time', () => {
    const report = punctualityReport([
      landed(DELAY_THRESHOLD_MINUTES),
      landed(-15),
      landed(40),
    ]);
    expect(report.assessedFlights).toBe(3);
    expect(report.delayedFlights).toBe(1);
    expect(report.totalDelayMinutes).toBe(40);
    expect(report.worstDelayMinutes).toBe(40);
    expect(report.delayRate).toBeCloseTo((1 / 3) * 100);
  });

  it('totals time gained by early arrivals, with the best one', () => {
    const report = punctualityReport([landed(-15), landed(-10)]);
    expect(report.earlyFlights).toBe(2);
    expect(report.totalEarlyMinutes).toBe(25);
    expect(report.bestEarlyMinutes).toBe(15);
  });

  it('ranks airlines by accumulated delay', () => {
    const report = punctualityReport([
      landed(30, { airline: { name: 'Alpha' } }),
      landed(5, { airline: { name: 'Alpha' } }),
      landed(120, { airline: { name: 'Beta' } }),
      landed(0, { airline: { name: 'Gamma' } }),
    ]);

    // Gamma was never late, so it isn't ranked
    expect(report.groups.airlines.map((a) => a.key)).toEqual(['Beta', 'Alpha']);
    expect(report.groups.airlines[0]).toMatchObject({
      totalDelayMinutes: 120,
      delayedFlights: 1,
      assessedFlights: 1,
    });
    const alpha = report.groups.airlines.find((a) => a.key === 'Alpha')!;
    expect(alpha.delayRate).toBeCloseTo(50);
  });

  it('groups delays by route and departing airport too', () => {
    const report = punctualityReport([
      landed(30, { from: 'CPH', to: 'LHR' }),
      landed(60, { from: 'ARN', to: 'LHR' }),
      landed(20, { from: 'LHR', to: 'CPH' }),
    ]);

    expect(
      report.groups.routes.map((r) => [r.key, r.totalDelayMinutes]),
    ).toEqual([
      ['ARN – LHR', 60],
      ['CPH – LHR', 50],
    ]);
    // Departures only: LHR is only counted for the flight leaving it
    expect(
      report.groups['departure-airports'].map((a) => [
        a.key,
        a.totalDelayMinutes,
      ]),
    ).toEqual([
      ['ARN', 60],
      ['CPH', 30],
      ['LHR', 20],
    ]);
  });

  it('averages over delayed flights only', () => {
    const report = punctualityReport([
      landed(60, { airline: { name: 'Alpha' } }),
      landed(10, { airline: { name: 'Alpha' } }),
      landed(20, { airline: { name: 'Beta' } }),
      landed(20, { airline: { name: 'Beta' } }),
      landed(20, { airline: { name: 'Beta' } }),
      landed(20, { airline: { name: 'Beta' } }),
    ]);

    expect(report.groups.airlines.map((a) => a.key)).toEqual(['Beta', 'Alpha']);
    expect(
      byAverageDelay(report.groups.airlines).map((a) => [
        a.key,
        a.averageDelayMinutes,
      ]),
    ).toEqual([
      ['Alpha', 60],
      ['Beta', 20],
    ]);
  });

  it('lists only delayed flights, most late first', () => {
    const report = punctualityReport([landed(20), landed(-10), landed(60)]);
    expect(report.delays.map((d) => d.delayMinutes)).toEqual([60, 20]);
  });

  it('lists flights that tie on delay newest first, as the flight list does', () => {
    const older = landed(30, { date: '2023-05-01' });
    const newer = landed(30, { date: '2024-05-01' });
    const added = landed(30, { date: '2022-01-01' });
    const movedLater = landed(30, { date: '2022-01-01', sortKey: 1e9 });
    const report = punctualityReport([older, added, movedLater, newer]);
    expect(report.delays.map((d) => d.flight)).toEqual([
      newer,
      older,
      movedLater,
      added,
    ]);
  });
});

describe('formatSignedDelay', () => {
  it('signs late and early arrivals', () => {
    expect(formatSignedDelay(75)).toBe('+1h 15m');
    expect(formatSignedDelay(-8)).toBe('−8m');
  });
});
