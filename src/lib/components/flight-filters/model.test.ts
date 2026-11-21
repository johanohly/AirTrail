import { TZDate } from '@date-fns/tz';
import { CalendarDate } from '@internationalized/date';
import { describe, expect, it } from 'vitest';

import type { OptionFilterId } from './definitions';
import {
  activeDatePreset,
  bitsFiltersToFlightFilters,
  bitsSignature,
  cloneFlightFilters,
  createDefaultFilters,
  filterOptions,
  filterScope,
  flightFiltersToBits,
  flightMatcher,
  optionFilterState,
  perYearFilters,
  selectedFilterYears,
  setOptionFilter,
  toggleDatePreset,
  toggleFilterYear,
} from './model';
import { createDefaultTempFilters, type FlightFilters } from './types';

import type { FiltersState } from '$lib/primitives';
import type { FlightData } from '$lib/utils';

type FlightInput = {
  id?: number;
  from?: [id: number, country: string, continent: string];
  to?: [id: number, country: string, continent: string];
  date?: string;
  datePrecision?: 'day' | 'month' | 'year';
  duration?: number | null;
  distance?: number | null;
  flightNumber?: string;
  passengers?: Array<{
    userId?: string;
    guestName?: string;
    seatClass?: string;
    seatNumber?: string;
  }>;
};

const airport = ([id, country, continent]: [number, string, string]) => ({
  id,
  iata: `A${id}`,
  icao: `AAA${id}`,
  name: `Airport ${id}`,
  country,
  continent,
});

const flight = ({
  id = 1,
  from = [1, 'DK', 'EU'],
  to = [2, 'FI', 'EU'],
  date = '2025-06-15T10:00:00',
  datePrecision = 'day',
  duration = 2 * 3600,
  distance = 900,
  flightNumber,
  passengers = [{ userId: 'maya' }],
}: FlightInput = {}) => {
  const day = new TZDate(date, 'UTC');
  return {
    id,
    from: airport(from),
    to: airport(to),
    date: day,
    dateStart: day,
    dateEnd: day,
    datePrecision,
    duration,
    distance,
    flightNumber: flightNumber ?? null,
    airline: null,
    aircraft: null,
    aircraftReg: null,
    passengers: passengers.map((passenger) => ({
      userId: passenger.userId ?? null,
      guestName: passenger.guestName ?? null,
      user: passenger.userId
        ? {
            id: passenger.userId,
            username: passenger.userId,
            displayName: passenger.userId,
          }
        : null,
      seat: null,
      seatClass: passenger.seatClass ?? null,
      seatNumber: passenger.seatNumber ?? null,
    })),
  } as unknown as FlightData;
};

const withOption = (
  id: OptionFilterId,
  values: string[],
  operator?: Parameters<typeof setOptionFilter>[2]['operator'],
  base: FlightFilters = createDefaultFilters(),
) => setOptionFilter(base, id, { values, operator });

const matchingIds = (
  flights: FlightData[],
  filters: FlightFilters,
  context?: Parameters<typeof flightMatcher>[1],
) => flights.filter(flightMatcher(filters, context)).map(({ id }) => id);

describe('option filters', () => {
  const flights = [
    flight({ id: 1, from: [1, 'DK', 'EU'], to: [2, 'FI', 'EU'] }),
    flight({ id: 2, from: [1, 'DK', 'EU'], to: [3, 'DK', 'EU'] }),
    flight({ id: 3, from: [4, 'US', 'NA'], to: [1, 'DK', 'EU'] }),
  ];

  it('matches countries, continents and domestic flights', () => {
    expect(
      matchingIds(flights, withOption('departureCountries', ['DK'])),
    ).toEqual([1, 2]);
    expect(
      matchingIds(flights, withOption('departureContinents', ['NA'])),
    ).toEqual([3]);
    expect(
      matchingIds(flights, withOption('flightType', ['domestic'])),
    ).toEqual([2]);
  });

  it('matches a route in either direction', () => {
    const outbound = flight({
      id: 4,
      from: [1, 'DK', 'EU'],
      to: [4, 'US', 'NA'],
    });
    expect(
      matchingIds([...flights, outbound], withOption('route', ['1|4'])),
    ).toEqual([3, 4]);
  });

  it('applies the excluding operators', () => {
    expect(
      matchingIds(flights, withOption('departureCountries', ['DK'], 'is not')),
    ).toEqual([3]);
  });

  it('drops a filter once its last value is removed', () => {
    const filters = withOption('departureCountries', ['DK']);
    expect(
      setOptionFilter(filters, 'departureCountries', { values: [] }).options,
    ).toEqual({});
  });

  it('keeps an operator meaning when the number of values changes', () => {
    const one = withOption('airline', ['SAS'], 'is not');
    const two = setOptionFilter(one, 'airline', { values: ['SAS', 'KLM'] });
    expect(optionFilterState(two, 'airline').operator).toBe('is none of');

    const all = withOption(
      'passengers',
      ['user:a', 'user:b'],
      'include all of',
    );
    const single = setOptionFilter(all, 'passengers', { values: ['user:a'] });
    expect(optionFilterState(single, 'passengers').operator).toBe('include');
  });

  it('starts an empty filter on the singular operator', () => {
    const empty = createDefaultFilters();
    expect(optionFilterState(empty, 'airline').operator).toBe('is');
    expect(optionFilterState(empty, 'passengers').operator).toBe('include');
  });
});

describe('flight time filter', () => {
  it('buckets by the flight time, not the distance', () => {
    const shortHop = flight({ id: 1, duration: 5 * 3600, distance: 200 });
    const unknown = flight({ id: 2, duration: null, distance: 9000 });
    expect(
      matchingIds([shortHop, unknown], withOption('duration', ['medium'])),
    ).toEqual([1]);
    expect(
      matchingIds([shortHop, unknown], withOption('duration', ['ultralong'])),
    ).toEqual([]);
  });
});

describe('month and day filters', () => {
  const flights = [
    flight({ id: 1, date: '2025-01-15T10:00:00' }),
    flight({ id: 2, date: '2025-01-01T12:00:00', datePrecision: 'month' }),
    flight({ id: 3, date: '2025-01-01T12:00:00', datePrecision: 'year' }),
  ];

  it('ignores dates saved as just a year for the month', () => {
    expect(matchingIds(flights, withOption('month', ['0']))).toEqual([1, 2]);
  });

  it('ignores dates without a day for the day of month', () => {
    expect(matchingIds(flights, withOption('dayOfMonth', ['1']))).toEqual([]);
    expect(matchingIds(flights, withOption('dayOfMonth', ['15']))).toEqual([1]);
  });
});

describe('seat filters', () => {
  const flights = [
    flight({
      id: 1,
      passengers: [
        { userId: 'maya', seatClass: 'economy', seatNumber: '12A' },
        { userId: 'jonas', seatClass: 'business', seatNumber: '2C' },
      ],
    }),
    flight({
      id: 2,
      passengers: [{ userId: 'maya', seatClass: 'business', seatNumber: '3A' }],
    }),
  ];
  const business = withOption('seatClass', ['business']);

  it("reads the shown user's seat", () => {
    expect(matchingIds(flights, business, { seatUserId: 'maya' })).toEqual([2]);
  });

  it("reads anyone's seat when all users are shown", () => {
    expect(matchingIds(flights, business)).toEqual([1, 2]);
  });

  it('reads the seats of the passengers an including filter picks', () => {
    const jonas = withOption('passengers', ['user:jonas'], 'include', business);
    expect(matchingIds(flights, jonas, { seatUserId: 'maya' })).toEqual([1]);
  });

  it('ignores an excluding passenger filter', () => {
    const notJonas = withOption(
      'passengers',
      ['user:jonas'],
      'exclude',
      business,
    );
    expect(matchingIds(flights, notJonas, { seatUserId: 'maya' })).toEqual([2]);
  });

  it('offers only the seats it reads, in seat order', () => {
    const options = filterOptions(flights, {
      scope: filterScope(createDefaultFilters(), 'maya'),
    });
    expect(options.seatNumber.map(({ value }) => value)).toEqual(['3A', '12A']);
  });

  it('offers the seats of the passengers an including filter picks', () => {
    const jonas = withOption('passengers', ['user:jonas'], 'include');
    const options = filterOptions(flights, {
      scope: filterScope(jonas, 'maya'),
    });
    expect(options.seatNumber.map(({ value }) => value)).toEqual(['2C']);
  });

  it('offers seat numbers the way the statistics count them', () => {
    const spelled = [
      flight({ id: 1, passengers: [{ userId: 'maya', seatNumber: '12a' }] }),
      flight({ id: 2, passengers: [{ userId: 'maya', seatNumber: ' 012A' }] }),
    ];
    const options = filterOptions(spelled, { scope: {} });
    expect(options.seatNumber).toMatchObject([{ value: '12A', count: 2 }]);
  });
});

describe('map drilldown', () => {
  const flights = [
    flight({ id: 1, from: [1, 'DK', 'EU'], to: [2, 'FI', 'EU'] }),
    flight({ id: 2, from: [2, 'FI', 'EU'], to: [3, 'DK', 'EU'] }),
    flight({ id: 3, from: [4, 'US', 'NA'], to: [2, 'FI', 'EU'] }),
  ];
  const tempFilters = { ...createDefaultTempFilters(), airportsEither: ['2'] };

  it('replaces the airport filters but keeps the others', () => {
    const filters = withOption(
      'departureAirports',
      ['1'],
      undefined,
      withOption('departureContinents', ['EU']),
    );
    expect(matchingIds(flights, filters)).toEqual([1]);
    expect(matchingIds(flights, filters, { tempFilters })).toEqual([1, 2]);
  });

  it('replaces a pinned airport', () => {
    const filters = cloneFlightFilters(createDefaultFilters(), {
      airportsEither: ['4'],
    });
    expect(matchingIds(flights, filters)).toEqual([3]);
    expect(matchingIds(flights, filters, { tempFilters })).toEqual([1, 2, 3]);
  });

  it('counts options among the drilldown flights only', () => {
    const options = filterOptions(flights, {
      scope: {},
      tempFilters: { ...createDefaultTempFilters(), departureAirports: ['2'] },
    });
    expect(options.arrivalCountries).toMatchObject([{ value: 'DK', count: 1 }]);
  });
});

describe('options', () => {
  it('lists known options in their own order with counts', () => {
    const flights = [
      flight({ id: 1, to: [2, 'US', 'NA'] }),
      flight({ id: 2, to: [3, 'DK', 'EU'] }),
      flight({ id: 3, to: [4, 'FI', 'EU'] }),
    ];
    const { arrivalContinents } = filterOptions(flights, { scope: {} });
    expect(arrivalContinents).toEqual([
      { value: 'EU', label: 'Europe', count: 2 },
      { value: 'NA', label: 'North America', count: 1 },
    ]);
  });

  it('labels countries by name and sorts by count', () => {
    const flights = [
      flight({ id: 1, to: [2, 'FI', 'EU'] }),
      flight({ id: 2, to: [3, 'DK', 'EU'] }),
      flight({ id: 3, to: [4, 'DK', 'EU'] }),
    ];
    const { arrivalCountries } = filterOptions(flights, { scope: {} });
    expect(arrivalCountries.map(({ label, count }) => [label, count])).toEqual([
      ['Denmark', 2],
      ['Finland', 1],
    ]);
  });
});

describe('bits filter state', () => {
  it('round-trips the filters and keeps the map pins', () => {
    const filters = cloneFlightFilters(
      withOption('passengers', ['user:maya', 'user:jonas'], 'include all of'),
      {
        fromDate: new CalendarDate(2025, 1, 1),
        toDate: new CalendarDate(2025, 3, 31),
        routes: [{ a: '1', b: '2' }],
      },
    );
    const bits = flightFiltersToBits(filters);
    expect(bits.map(({ columnId, type }) => [columnId, type])).toEqual([
      ['passengers', 'multiOption'],
      ['date', 'date'],
    ]);
    expect(bitsFiltersToFlightFilters(bits, filters)).toEqual(filters);
  });

  it('settles after one round trip from an exclusive date bound', () => {
    const before: FiltersState = [
      {
        columnId: 'date',
        type: 'date',
        operator: 'is before',
        values: [new Date(2025, 2, 10)],
      },
    ];
    const once = bitsFiltersToFlightFilters(before, createDefaultFilters());
    expect(once.toDate?.toString()).toBe('2025-03-09');
    const bits = flightFiltersToBits(once);
    expect(
      bitsSignature(
        flightFiltersToBits(bitsFiltersToFlightFilters(bits, once)),
      ),
    ).toBe(bitsSignature(bits));
  });
});

describe('date presets', () => {
  const today = new CalendarDate(2026, 11, 21);

  it('applies a preset and clears it when picked again', () => {
    const applied = toggleDatePreset(
      createDefaultFilters(),
      'past-30-days',
      today,
    );
    expect(applied.fromDate?.toString()).toBe('2026-10-23');
    expect(applied.toDate?.toString()).toBe('2026-11-21');
    expect(activeDatePreset(applied, today)).toBe('past-30-days');

    const cleared = toggleDatePreset(applied, 'past-30-days', today);
    expect(cleared.fromDate).toBeUndefined();
  });

  it('reads this year as the selected year', () => {
    const thisYear = toggleDatePreset(
      createDefaultFilters(),
      'this-year',
      today,
    );
    expect(selectedFilterYears(thisYear)).toEqual(['2026']);
  });
});

describe('year filter', () => {
  it('selects a year and replaces any other date filter', () => {
    const next = toggleFilterYear(
      cloneFlightFilters(createDefaultFilters(), {
        fromDate: new CalendarDate(2024, 3, 1),
        toDate: new CalendarDate(2024, 4, 1),
      }),
      '2025',
    );
    expect(next.options.year).toEqual({ values: ['2025'], operator: 'is' });
    expect(next.fromDate).toBeUndefined();
    expect(next.toDate).toBeUndefined();
  });

  it('clears the filter when the selected year is picked again', () => {
    const next = toggleFilterYear(withOption('year', ['2025']), '2025');
    expect(next.options.year).toBeUndefined();
  });

  it('narrows several selected years down to the picked one', () => {
    const next = toggleFilterYear(withOption('year', ['2024', '2025']), '2025');
    expect(next.options.year?.values).toEqual(['2025']);
  });

  it('keeps other filters', () => {
    const next = toggleFilterYear(withOption('airline', ['SAS']), '2025');
    expect(next.options.airline?.values).toEqual(['SAS']);
  });

  it('does not read an excluded year or a custom range as selected', () => {
    expect(selectedFilterYears(withOption('year', ['2025'], 'is not'))).toEqual(
      [],
    );
    expect(
      selectedFilterYears(
        cloneFlightFilters(createDefaultFilters(), {
          fromDate: new CalendarDate(2025, 2, 1),
          toDate: new CalendarDate(2025, 3, 1),
        }),
      ),
    ).toEqual([]);
  });

  it('counts per year without a year or date filter once a year is picked', () => {
    const both = cloneFlightFilters(withOption('year', ['2025']), {
      fromDate: new CalendarDate(2025, 2, 1),
    });
    const perYear = perYearFilters(both);
    expect(perYear.options.year).toBeUndefined();
    expect(perYear.fromDate).toBeUndefined();
  });

  it('counts per year without a year filter but with a custom range', () => {
    expect(
      perYearFilters(withOption('year', ['2025'])).options.year,
    ).toBeUndefined();
    const fromDate = new CalendarDate(2025, 2, 1);
    const ranged = cloneFlightFilters(createDefaultFilters(), { fromDate });
    expect(perYearFilters(ranged).fromDate).toEqual(fromDate);
  });
});
