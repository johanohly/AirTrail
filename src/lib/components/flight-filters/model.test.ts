import { CalendarDate } from '@internationalized/date';
import { describe, expect, it } from 'vitest';

import {
  activeDatePreset,
  activeDatePresetForRange,
  applyDatePreset,
  cloneFlightFilters,
  createDefaultFilters,
  dateFilterSummary,
  datePresetRange,
  datePresets,
  flightFiltersToBits,
  perYearFilters,
  selectedFilterYears,
  toggleFilterYear,
} from './model';

const filters = (next = {}) => cloneFlightFilters(createDefaultFilters(), next);

describe('year filter', () => {
  it('selects a year and replaces any other date filter', () => {
    const next = toggleFilterYear(
      filters({
        fromDate: new CalendarDate(2024, 3, 1),
        toDate: new CalendarDate(2024, 4, 1),
      }),
      '2025',
    );
    expect(next.years).toEqual(['2025']);
    expect(next.yearsOperator).toBe('is');
    expect(next.fromDate).toBeUndefined();
    expect(next.toDate).toBeUndefined();
  });

  it('clears the filter when the selected year is picked again', () => {
    const next = toggleFilterYear(
      filters({ years: ['2025'], yearsOperator: 'is' }),
      '2025',
    );
    expect(next.years).toEqual([]);
  });

  it('narrows several selected years down to the picked one', () => {
    const next = toggleFilterYear(filters({ years: ['2024', '2025'] }), '2025');
    expect(next.years).toEqual(['2025']);
  });

  it('keeps other filters', () => {
    const next = toggleFilterYear(filters({ airline: ['1'] }), '2025');
    expect(next.airline).toEqual(['1']);
  });

  it('reads a full year range as that year', () => {
    expect(
      selectedFilterYears(
        filters({
          fromDate: new CalendarDate(2025, 1, 1),
          toDate: new CalendarDate(2025, 12, 31),
        }),
      ),
    ).toEqual(['2025']);
  });

  it('does not read an excluded year or a custom range as selected', () => {
    expect(
      selectedFilterYears(
        filters({ years: ['2025'], yearsOperator: 'is not' }),
      ),
    ).toEqual([]);
    expect(
      selectedFilterYears(
        filters({
          fromDate: new CalendarDate(2025, 2, 1),
          toDate: new CalendarDate(2025, 3, 1),
        }),
      ),
    ).toEqual([]);
  });

  it('counts per year without a year filter but with a custom range', () => {
    expect(perYearFilters(filters({ years: ['2025'] })).years).toEqual([]);
    const fromDate = new CalendarDate(2025, 2, 1);
    expect(perYearFilters(filters({ fromDate })).fromDate).toEqual(fromDate);
  });
});

describe('date presets', () => {
  const today = new CalendarDate(2026, 6, 15);

  it('resolves preset ranges', () => {
    expect(datePresetRange('past-30-days', today)).toEqual({
      fromDate: new CalendarDate(2026, 5, 17),
      toDate: today,
    });
    expect(datePresetRange('past-90-days', today)).toEqual({
      fromDate: new CalendarDate(2026, 3, 18),
      toDate: today,
    });
    expect(datePresetRange('past-12-months', today)).toEqual({
      fromDate: new CalendarDate(2025, 6, 16),
      toDate: today,
    });
    expect(datePresetRange('this-month', today)).toEqual({
      fromDate: new CalendarDate(2026, 6, 1),
      toDate: new CalendarDate(2026, 6, 30),
    });
    expect(datePresetRange('last-month', today)).toEqual({
      fromDate: new CalendarDate(2026, 5, 1),
      toDate: new CalendarDate(2026, 5, 31),
    });
    expect(datePresetRange('this-year', today)).toEqual({
      fromDate: new CalendarDate(2026, 1, 1),
      toDate: new CalendarDate(2026, 12, 31),
    });
    expect(datePresetRange('last-year', today)).toEqual({
      fromDate: new CalendarDate(2025, 1, 1),
      toDate: new CalendarDate(2025, 12, 31),
    });
  });

  it('handles leap years when rolling back 12 months', () => {
    expect(
      datePresetRange('past-12-months', new CalendarDate(2024, 3, 1)),
    ).toEqual({
      fromDate: new CalendarDate(2023, 3, 2),
      toDate: new CalendarDate(2024, 3, 1),
    });
  });

  it('handles month boundaries for month presets', () => {
    expect(
      datePresetRange('this-month', new CalendarDate(2026, 1, 15)),
    ).toEqual({
      fromDate: new CalendarDate(2026, 1, 1),
      toDate: new CalendarDate(2026, 1, 31),
    });
    expect(
      datePresetRange('last-month', new CalendarDate(2026, 1, 15)),
    ).toEqual({
      fromDate: new CalendarDate(2025, 12, 1),
      toDate: new CalendarDate(2025, 12, 31),
    });
    expect(
      datePresetRange('this-month', new CalendarDate(2024, 2, 10)),
    ).toEqual({
      fromDate: new CalendarDate(2024, 2, 1),
      toDate: new CalendarDate(2024, 2, 29),
    });
  });

  it('applies a rolling preset in place of any date filter', () => {
    const next = applyDatePreset(
      filters({
        years: ['2025'],
        fromDate: new CalendarDate(2026, 1, 1),
        toDate: new CalendarDate(2026, 3, 1),
        airline: ['1'],
      }),
      'past-30-days',
      today,
    );
    expect(next.years).toEqual([]);
    expect(next.fromDate).toEqual(new CalendarDate(2026, 5, 17));
    expect(next.toDate).toEqual(today);
    expect(next.airline).toEqual(['1']);
  });

  it('applies calendar-year presets as full-year date ranges', () => {
    const next = applyDatePreset(filters(), 'this-year', today);
    expect(next.years).toEqual([]);
    expect(next.yearsOperator).toBe('is any of');
    expect(next.fromDate).toEqual(new CalendarDate(2026, 1, 1));
    expect(next.toDate).toEqual(new CalendarDate(2026, 12, 31));
  });

  it('stays a date filter for a full year range but keeps year filters', () => {
    const dateBits = flightFiltersToBits(
      filters({
        fromDate: new CalendarDate(2026, 1, 1),
        toDate: new CalendarDate(2026, 12, 31),
      }),
    );
    expect(dateBits).toHaveLength(1);
    expect(dateBits[0]?.columnId).toBe('date');
    expect(dateBits[0]?.operator).toBe('is between');

    const yearBits = flightFiltersToBits(filters({ years: ['2026'] }));
    expect(yearBits).toHaveLength(1);
    expect(yearBits[0]?.columnId).toBe('year');
  });

  it('summarizes a full year range as its year', () => {
    expect(
      dateFilterSummary(
        filters({
          fromDate: new CalendarDate(2026, 1, 1),
          toDate: new CalendarDate(2026, 12, 31),
        }),
        { dateFormat: 'iso' },
      ),
    ).toBe('2026');
  });

  it('reads every applied preset back as active', () => {
    for (const preset of datePresets) {
      const applied = applyDatePreset(filters(), preset.id, today);
      expect(activeDatePreset(applied, today)).toBe(preset.id);
    }
  });

  it('reads a full year range without a year filter as this year', () => {
    expect(
      activeDatePreset(
        filters({
          fromDate: new CalendarDate(2026, 1, 1),
          toDate: new CalendarDate(2026, 12, 31),
        }),
        today,
      ),
    ).toBe('this-year');
  });

  it('does not read a custom range as a preset', () => {
    expect(
      activeDatePreset(
        filters({
          fromDate: new CalendarDate(2026, 1, 1),
          toDate: new CalendarDate(2026, 3, 1),
        }),
        today,
      ),
    ).toBeUndefined();
  });

  it('stops matching a rolling preset the next day', () => {
    const applied = applyDatePreset(filters(), 'past-30-days', today);
    expect(
      activeDatePreset(applied, new CalendarDate(2026, 6, 16)),
    ).toBeUndefined();
  });

  it('does not read other years as a preset', () => {
    expect(
      activeDatePreset(filters({ years: ['2024'] }), today),
    ).toBeUndefined();
  });

  it('matches a plain date range to a preset directly', () => {
    expect(
      activeDatePresetForRange(
        new CalendarDate(2026, 1, 1),
        new CalendarDate(2026, 12, 31),
        today,
      ),
    ).toBe('this-year');
    expect(
      activeDatePresetForRange(new CalendarDate(2026, 5, 17), today, today),
    ).toBe('past-30-days');
    expect(
      activeDatePresetForRange(
        new CalendarDate(2026, 1, 1),
        new CalendarDate(2026, 3, 1),
        today,
      ),
    ).toBeUndefined();
    expect(
      activeDatePresetForRange(undefined, undefined, today),
    ).toBeUndefined();
  });
});
