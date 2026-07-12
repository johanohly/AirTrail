import { describe, expect, it } from 'vitest';

import {
  altitudeUnitLabel,
  convertAltitude,
  formatCompactDateWithWeekday,
  formatCompactFlightDate,
  formatDate,
  formatDateTime,
  formatFlightDate,
  formatTime,
} from './format';

describe('altitude preferences', () => {
  it('uses metres with metric distance preferences', () => {
    const prefs = { distanceUnit: 'km' } as const;

    expect(convertAltitude(10_000, prefs)).toBeCloseTo(3_048);
    expect(altitudeUnitLabel(prefs)).toBe('m');
  });

  it.each(['mi', 'nm'] as const)(
    'uses feet with %s distance preferences',
    (distanceUnit) => {
      const prefs = { distanceUnit };

      expect(convertAltitude(10_000, prefs)).toBe(10_000);
      expect(altitudeUnitLabel(prefs)).toBe('ft');
    },
  );
});

describe('date preferences', () => {
  const date = new Date('2026-04-26T22:30:00.000Z');

  it.each([
    ['iso', '2026-04-26'],
    ['us', '04/26/2026'],
    ['eu', '26/04/2026'],
  ] as const)('formats a full date as %s', (dateFormat, expected) => {
    expect(formatDate(date, { dateFormat }, 'UTC')).toBe(expected);
  });

  it('applies the display timezone before formatting the calendar date', () => {
    expect(formatDate(date, { dateFormat: 'iso' }, 'Asia/Tokyo')).toBe(
      '2026-04-27',
    );
  });

  it.each([
    ['day', '2026-04-26'],
    ['month', '2026-04'],
    ['year', '2026'],
  ] as const)(
    'formats %s-precision ISO flight dates',
    (precision, expected) => {
      expect(
        formatFlightDate(date, precision, { dateFormat: 'iso' }, 'UTC'),
      ).toBe(expected);
    },
  );

  it.each([
    ['us', '04/2026'],
    ['eu', '04/2026'],
  ] as const)(
    'formats month-precision %s flight dates',
    (dateFormat, expected) => {
      expect(formatFlightDate(date, 'month', { dateFormat }, 'UTC')).toBe(
        expected,
      );
    },
  );

  it('keeps compact detail-panel dates in the short-month style', () => {
    expect(formatCompactFlightDate(date, 'day', 'UTC')).toBe('Apr 26, 2026');
    expect(formatCompactFlightDate(date, 'month', 'UTC')).toBe('Apr 2026');
    expect(formatCompactFlightDate(date, 'year', 'UTC')).toBe('2026');
    expect(formatCompactDateWithWeekday(date, 'UTC')).toBe('Sun, Apr 26');
  });
});

describe('time preferences', () => {
  const date = new Date('2026-04-26T22:30:00.000Z');

  it('formats explicit 12-hour and 24-hour clocks', () => {
    expect(formatTime(date, { timeFormat: '12h' }, 'UTC')).toBe('10:30 PM');
    expect(formatTime(date, { timeFormat: '24h' }, 'UTC')).toBe('22:30');
  });

  it('combines the preferred date and time formats', () => {
    expect(
      formatDateTime(date, { dateFormat: 'iso', timeFormat: '24h' }, 'UTC'),
    ).toBe('2026-04-26 22:30');
  });
});
