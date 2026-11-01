import { TZDate } from '@date-fns/tz';
import { CalendarDate } from '@internationalized/date';
import { describe, expect, it } from 'vitest';

import {
  activeDatePreset,
  activeDatePresetForRange,
  applyDatePreset,
  bitsFiltersToFlightFilters,
  cloneFlightFilters,
  createDefaultFilters,
  dateFilterSummary,
  datePresetRange,
  datePresets,
  flightFiltersToBits,
  flightSignature,
  flightTypeForFlight,
  hasFlightFilters,
  matchesFlight,
  optionColumnOperator,
  optionColumnValues,
  perYearFilters,
  selectedFilterYears,
  setOptionColumnOperator,
  setOptionColumnValues,
  seatFilterContext,
  toggleFilterYear,
} from './model';
import { durationBucketFor } from './options';

import type { FlightData } from '$lib/utils';

const filters = (next = {}) => cloneFlightFilters(createDefaultFilters(), next);

// Date parts are read in the given zone, so the host zone can't move a
// flight into another month or day
const at = (year: number, month: number, day: number) =>
  new TZDate(year, month - 1, day, 12, 0, 'UTC');

const flight = (next: Record<string, unknown> = {}) =>
  ({
    from: { id: 1, country: 'DE' },
    to: { id: 2, country: 'US' },
    date: at(2024, 5, 15),
    distance: 800,
    flightNumber: 'LH123',
    passengers: [],
    ...next,
  }) as unknown as FlightData;

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

describe('flight type filter', () => {
  it('derives domestic and international from airport countries', () => {
    expect(flightTypeForFlight(flight())).toBe('international');
    expect(flightTypeForFlight(flight({ to: { id: 3, country: 'DE' } }))).toBe(
      'domestic',
    );
    expect(flightTypeForFlight(flight({ to: null }))).toBeUndefined();
  });

  it('matches flights by flight type', () => {
    expect(
      matchesFlight(
        flight({ to: { id: 3, country: 'DE' } }),
        filters({ flightType: ['domestic'] }),
      ),
    ).toBe(true);
    expect(matchesFlight(flight(), filters({ flightType: ['domestic'] }))).toBe(
      false,
    );
  });

  it('matches flights without airports only under is none of', () => {
    const noArrival = flight({ to: null });
    expect(
      matchesFlight(noArrival, filters({ flightType: ['international'] })),
    ).toBe(false);
    expect(
      matchesFlight(
        noArrival,
        filters({
          flightType: ['international'],
          flightTypeOperator: 'is none of',
        }),
      ),
    ).toBe(true);
  });
});

describe('duration filter', () => {
  // estimateFlightDuration reads hours = km / 805 + 0.5
  const kmForHours = (hours: number) => (hours - 0.5) * 805;

  it('buckets flights by estimated duration', () => {
    expect(durationBucketFor(kmForHours(2.99))).toBe('short');
    expect(durationBucketFor(kmForHours(3))).toBe('medium');
    expect(durationBucketFor(kmForHours(5.99))).toBe('medium');
    expect(durationBucketFor(kmForHours(6))).toBe('long');
    expect(durationBucketFor(kmForHours(11.99))).toBe('long');
    expect(durationBucketFor(kmForHours(12))).toBe('ultralong');
    expect(durationBucketFor(null)).toBeUndefined();
    expect(durationBucketFor(undefined)).toBeUndefined();
  });

  it('matches flights by duration bucket', () => {
    expect(matchesFlight(flight(), filters({ duration: ['short'] }))).toBe(
      true,
    );
    expect(matchesFlight(flight(), filters({ duration: ['ultralong'] }))).toBe(
      false,
    );
  });

  it('matches flights without a distance only under is none of', () => {
    const noDistance = flight({ distance: null });
    expect(matchesFlight(noDistance, filters({ duration: ['short'] }))).toBe(
      false,
    );
    expect(
      matchesFlight(
        noDistance,
        filters({ duration: ['short'], durationOperator: 'is none of' }),
      ),
    ).toBe(true);
  });
});

describe('month and day filters', () => {
  it('filters by month index and day of month', () => {
    expect(matchesFlight(flight(), filters({ months: ['4'] }))).toBe(true);
    expect(matchesFlight(flight(), filters({ months: ['5'] }))).toBe(false);
    expect(matchesFlight(flight(), filters({ days: ['15'] }))).toBe(true);
    expect(matchesFlight(flight(), filters({ days: ['16'] }))).toBe(false);
  });

  it('matches flights without a date only under is none of', () => {
    const noDate = flight({ date: null });
    expect(matchesFlight(noDate, filters({ months: ['4'] }))).toBe(false);
    expect(
      matchesFlight(
        noDate,
        filters({ months: ['4'], monthsOperator: 'is none of' }),
      ),
    ).toBe(true);
    expect(matchesFlight(noDate, filters({ days: ['15'] }))).toBe(false);
    expect(
      matchesFlight(
        noDate,
        filters({ days: ['15'], daysOperator: 'is none of' }),
      ),
    ).toBe(true);
  });
});

describe('seat filters', () => {
  const passengers = [
    { userId: 'u1', seatClass: 'business' },
    { userId: 'u2', seatClass: 'economy' },
  ];
  const guestPassengers = [{ guestName: 'Ana', seatClass: 'business' }];

  it('consults the seat user row when a scope is given', () => {
    const booked = flight({ passengers });
    const business = filters({ seatClass: ['business'] });
    expect(matchesFlight(booked, business, { seatUserId: 'u1' })).toBe(true);
    expect(matchesFlight(booked, business, { seatUserId: 'u2' })).toBe(false);
    expect(matchesFlight(booked, business)).toBe(true);
  });

  it('negates seat classes within the seat user row', () => {
    const booked = flight({ passengers });
    const notEconomy = filters({
      seatClass: ['economy'],
      seatClassOperator: 'is none of',
    });
    expect(matchesFlight(booked, notEconomy, { seatUserId: 'u2' })).toBe(false);
    expect(matchesFlight(booked, notEconomy, { seatUserId: 'u1' })).toBe(true);
  });

  it('scopes seat filters to the rows of an inclusive passengers filter', () => {
    const passengersFilter = filters({ passengers: ['user:u2'] });
    const ctx = seatFilterContext(passengersFilter);
    expect(ctx).toEqual({ passengerTokens: ['user:u2'] });

    const booked = flight({ passengers });
    expect(
      matchesFlight(
        booked,
        filters({ passengers: ['user:u2'], seatClass: ['business'] }),
        ctx,
      ),
    ).toBe(false);
    expect(
      matchesFlight(
        booked,
        filters({ passengers: ['user:u2'], seatClass: ['economy'] }),
        ctx,
      ),
    ).toBe(true);
  });

  it('falls through to the scope when the passengers filter is exclusive', () => {
    const exclusive = filters({
      passengers: ['user:u2'],
      passengersOperator: 'exclude if any of',
    });
    expect(seatFilterContext(exclusive, 'u1')).toEqual({ seatUserId: 'u1' });
  });

  it('scopes seat filters to guest rows by token', () => {
    const booked = flight({ passengers: guestPassengers });
    const ctx = seatFilterContext(filters({ passengers: ['guest:Ana'] }));
    expect(
      matchesFlight(
        booked,
        filters({ passengers: ['guest:Ana'], seatClass: ['business'] }),
        ctx,
      ),
    ).toBe(true);
    expect(
      matchesFlight(
        booked,
        filters({ passengers: ['guest:Ana'], seatClass: ['economy'] }),
        ctx,
      ),
    ).toBe(false);
  });

  it('filters by seat type, reason, and seat number', () => {
    const booked = flight({
      passengers: [
        {
          userId: 'u1',
          seat: 'window',
          flightReason: 'leisure',
          seatNumber: '12A',
        },
      ],
    });
    expect(
      matchesFlight(booked, filters({ seatType: ['window'] }), {
        seatUserId: 'u1',
      }),
    ).toBe(true);
    expect(
      matchesFlight(booked, filters({ seatType: ['aisle'] }), {
        seatUserId: 'u1',
      }),
    ).toBe(false);
    expect(
      matchesFlight(booked, filters({ flightReason: ['crew'] }), {
        seatUserId: 'u1',
      }),
    ).toBe(false);
    expect(
      matchesFlight(booked, filters({ seatNumber: ['12A'] }), {
        seatUserId: 'u1',
      }),
    ).toBe(true);
  });
});

describe('route filter', () => {
  it('keys routes canonically', () => {
    expect(optionColumnValues(filters(), 'routes')).toEqual([]);
    const next = setOptionColumnValues(filters(), 'routes', ['2|1']);
    expect(next.routes).toEqual([{ a: '1', b: '2' }]);
    expect(optionColumnValues(next, 'routes')).toEqual(['1|2']);
  });

  it('matches flights by route with operators', () => {
    const route = setOptionColumnValues(filters(), 'routes', ['1|2']);
    expect(matchesFlight(flight(), route)).toBe(true);
    expect(matchesFlight(flight({ to: null }), route)).toBe(false);
    expect(
      matchesFlight(flight({ to: null }), {
        ...route,
        routesOperator: 'is none of',
      }),
    ).toBe(true);
  });
});

describe('new option columns', () => {
  const cases = [
    ['flightType', ['domestic', 'international']],
    ['flightNumber', ['LH123', 'AB456']],
    ['duration', ['short', 'long']],
    ['seatClass', ['business', 'economy']],
    ['flightReason', ['leisure', 'business']],
    ['seatType', ['window', 'aisle']],
    ['seatNumber', ['12A', '14B']],
    ['months', ['4', '5']],
    ['days', ['14', '15']],
    ['routes', ['2|1', '3|4']],
  ] as const;

  it('round-trips values and operators through bits', () => {
    for (const [columnId, values] of cases) {
      const start = setOptionColumnOperator(
        setOptionColumnValues(filters(), columnId, [...values]),
        columnId,
        'is none of',
      );
      const round = bitsFiltersToFlightFilters(flightFiltersToBits(start));

      expect(optionColumnValues(round, columnId)).toEqual(
        columnId === 'routes' ? ['1|2', '3|4'] : values,
      );
      expect(optionColumnOperator(round, columnId)).toBe('is none of');
    }
  });

  it('reacts in hasFlightFilters and flightSignature', () => {
    expect(hasFlightFilters(filters())).toBe(false);
    expect(hasFlightFilters(filters({ months: ['4'] }))).toBe(true);
    expect(hasFlightFilters(filters({ routes: [{ a: '1', b: '2' }] }))).toBe(
      true,
    );

    const plain = flightSignature(filters());
    expect(flightSignature(filters({ days: ['5'] }))).not.toBe(plain);
    expect(
      flightSignature(filters({ days: ['5'], daysOperator: 'is' })),
    ).not.toBe(
      flightSignature(filters({ days: ['5'], daysOperator: 'is not' })),
    );
  });
});

describe('date presets and month filters', () => {
  const today = new CalendarDate(2026, 6, 15);
  const on = (year: number, month: number, day: number) => {
    const date = at(year, month, day);
    return { date, dateStart: date, dateEnd: date };
  };

  it('ands an applied preset with a month filter', () => {
    const filtered = applyDatePreset(
      filters({ months: ['4'] }),
      'this-year',
      today,
    );

    expect(matchesFlight(flight(on(2026, 5, 15)), filtered)).toBe(true);
    expect(matchesFlight(flight(on(2025, 5, 15)), filtered)).toBe(false);
    expect(matchesFlight(flight(on(2026, 3, 10)), filtered)).toBe(false);
  });
});
