import { describe, expect, it } from 'vitest';

import { resolveTimingStatus } from './flight-timing';

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
