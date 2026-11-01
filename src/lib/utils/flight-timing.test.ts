import { describe, expect, it } from 'vitest';

import { buildTimingSummary, resolveTimingStatus } from './flight-timing';

const time = (value: string) => new Date(`2026-10-29T${value}:00Z`);
const defaults = {
  gateActual: null,
  gateScheduled: time('12:00'),
  runwayActual: null,
  runwayScheduled: null,
};

describe.each(['departure', 'arrival'] as const)(
  '%s timing fallback',
  (side) => {
    it.each([
      ['11:59', 'early'],
      ['12:00', null],
      ['12:01', 'late'],
    ] as const)('preserves gate comparison for %s', (actual, expected) => {
      expect(
        resolveTimingStatus({
          ...defaults,
          side,
          gateActual: time(actual),
          runwayActual: time('13:00'),
          runwayScheduled: time('14:00'),
        }),
      ).toBe(expected);
    });

    it('does not fall back when a gate actual exists without a gate schedule', () => {
      expect(
        resolveTimingStatus({
          ...defaults,
          side,
          gateActual: time('12:00'),
          gateScheduled: null,
          runwayActual: time('13:00'),
          runwayScheduled: time('14:00'),
        }),
      ).toBeNull();
    });

    it.each([
      ['12:59', 'early'],
      ['13:00', null],
      ['13:01', 'late'],
    ] as const)(
      'uses the matching runway schedule for %s',
      (actual, expected) => {
        expect(
          resolveTimingStatus({
            ...defaults,
            side,
            runwayActual: time(actual),
            runwayScheduled: time('13:00'),
          }),
        ).toBe(expected);
      },
    );

    it.each(['11:59', '12:00', '12:01'])(
      'only infers certain gate status for %s',
      (actual) => {
        const expected =
          side === 'departure' && actual === '11:59'
            ? 'early'
            : side === 'arrival' && actual === '12:01'
              ? 'late'
              : null;
        expect(
          resolveTimingStatus({
            ...defaults,
            side,
            runwayActual: time(actual),
          }),
        ).toBe(expected);
      },
    );

    it('stays neutral without an actual or a schedule', () => {
      expect(resolveTimingStatus({ ...defaults, side })).toBeNull();
      expect(
        resolveTimingStatus({
          ...defaults,
          side,
          gateScheduled: null,
          runwayActual: time('12:00'),
        }),
      ).toBeNull();
    });

    it('compares full timestamps across midnight and time zones', () => {
      expect(
        resolveTimingStatus({
          ...defaults,
          side,
          runwayActual: new Date('2026-10-30T00:10:00+08:00'),
          runwayScheduled: new Date('2026-10-29T15:55:00Z'),
        }),
      ).toBe('late');
    });
  },
);

describe('buildTimingSummary', () => {
  const base = {
    gateActual: null,
    gateScheduled: time('12:00'),
    runwayActual: null,
    runwayScheduled: null,
    side: 'departure',
  } as const;

  it('says nothing without an actual time', () => {
    expect(buildTimingSummary(base)).toEqual({
      headline: null,
      status: null,
      evidence: [],
    });
  });

  it('compares gate times', () => {
    const summary = buildTimingSummary({ ...base, gateActual: time('12:20') });
    expect(summary.headline).toBe('20 min late');
    expect(summary.evidence).toEqual([
      { label: 'Scheduled', date: time('12:00') },
    ]);
  });

  it('calls a matching actual on time', () => {
    expect(
      buildTimingSummary({ ...base, gateActual: time('12:00') }).headline,
    ).toBe('On time');
  });

  it('gives the runway time and schedule behind a fallback', () => {
    const summary = buildTimingSummary({
      ...base,
      side: 'arrival',
      runwayActual: time('13:35'),
      runwayScheduled: time('12:20'),
    });
    expect(summary.headline).toBe('1 h 15 min late');
    expect(summary.evidence.map((n) => n.label)).toEqual([
      'Landed',
      'scheduled',
    ]);
  });

  it('shows a runway time without a verdict when taxi time could explain it', () => {
    const summary = buildTimingSummary({
      ...base,
      runwayActual: time('12:20'),
    });
    expect(summary.headline).toBeNull();
    expect(summary.evidence).toEqual([
      { label: 'Took off', date: time('12:20') },
    ]);
  });
});
