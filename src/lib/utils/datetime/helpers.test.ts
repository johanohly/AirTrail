import { describe, expect, it } from 'vitest';

import {
  getFlightDateRange,
  supportsMonthBreakdown,
  supportsWeekdayBreakdown,
} from './helpers';

describe('getFlightDateRange', () => {
  it('returns a full-year range for year precision', () => {
    const { start, end } = getFlightDateRange('2024-01-01', 'year', 'UTC');

    expect(new Date(start?.toISOString() ?? '').toISOString()).toBe(
      '2024-01-01T00:00:00.000Z',
    );
    expect(new Date(end?.toISOString() ?? '').toISOString()).toBe(
      '2024-12-31T23:59:59.999Z',
    );
  });

  it('returns a full-month range for month precision', () => {
    const { start, end } = getFlightDateRange('2024-02-01', 'month', 'UTC');

    expect(new Date(start?.toISOString() ?? '').toISOString()).toBe(
      '2024-02-01T00:00:00.000Z',
    );
    expect(new Date(end?.toISOString() ?? '').toISOString()).toBe(
      '2024-02-29T23:59:59.999Z',
    );
  });

  it('returns a single-day range for day precision', () => {
    const { start, end } = getFlightDateRange('2024-02-14', 'day', 'UTC');

    expect(new Date(start?.toISOString() ?? '').toISOString()).toBe(
      '2024-02-14T00:00:00.000Z',
    );
    expect(new Date(end?.toISOString() ?? '').toISOString()).toBe(
      '2024-02-14T23:59:59.999Z',
    );
  });
});

describe('date precision helpers', () => {
  it('only allows month breakdowns when month is known', () => {
    expect(supportsMonthBreakdown('day')).toBe(true);
    expect(supportsMonthBreakdown('month')).toBe(true);
    expect(supportsMonthBreakdown('year')).toBe(false);
  });

  it('only allows weekday breakdowns for exact dates', () => {
    expect(supportsWeekdayBreakdown('day')).toBe(true);
    expect(supportsWeekdayBreakdown('month')).toBe(false);
    expect(supportsWeekdayBreakdown('year')).toBe(false);
  });
});
