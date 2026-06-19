<script lang="ts" module>
  import { browser } from '$app/environment';

  const filterContentZIndexProperty = '--airtrail-filter-content-z-index';
  let filterContentZIndexStack: Array<{ id: symbol; value: string }> = [];
  let previousFilterContentZIndex: string | undefined;

  function applyFilterContentZIndex() {
    if (!browser) return;

    const root = document.documentElement;
    const current = filterContentZIndexStack.at(-1)?.value;

    if (current) {
      root.style.setProperty(filterContentZIndexProperty, current);
    } else if (previousFilterContentZIndex) {
      root.style.setProperty(
        filterContentZIndexProperty,
        previousFilterContentZIndex,
      );
      previousFilterContentZIndex = undefined;
    } else {
      root.style.removeProperty(filterContentZIndexProperty);
      previousFilterContentZIndex = undefined;
    }
  }

  function pushFilterContentZIndex(value: string) {
    if (!browser) return () => {};

    const root = document.documentElement;
    const id = Symbol('filter-content-z-index');

    if (filterContentZIndexStack.length === 0) {
      previousFilterContentZIndex =
        root.style.getPropertyValue(filterContentZIndexProperty) || undefined;
    }

    filterContentZIndexStack = [...filterContentZIndexStack, { id, value }];
    applyFilterContentZIndex();

    return () => {
      filterContentZIndexStack = filterContentZIndexStack.filter(
        (entry) => entry.id !== id,
      );
      applyFilterContentZIndex();
    };
  }
</script>

<script lang="ts">
  import { CalendarDate } from '@internationalized/date';
  import {
    Calendar,
    Funnel,
    Hash,
    Plane,
    PlaneLanding,
    PlaneTakeoff,
    UsersRound,
    X,
  } from '@o7/icon';
  import { Airlines } from '@o7/icon/material';
  import { Filter, useDataTableFilters } from 'bits-ui';
  import { createRawSnippet } from 'svelte';
  import type { Component } from 'svelte';
  import type {
    ColumnConfig,
    FilterIcon,
    FilterModel,
    FiltersState,
  } from 'bits-ui';

  import type {
    FlightFilters,
    MultiOptionFilterOperator,
    OptionFilterOperator,
    TempFilters,
  } from '$lib/components/flight-filters/types';
  import UserAvatar from '$lib/components/display/UserAvatar.svelte';
  import {
    cn,
    getSeatPassengerLabel,
    getSeatPassengerToken,
    type FlightData,
  } from '$lib/utils';
  import type { Airline, Airport } from '$lib/db/types';
  import { getModalContext } from '$lib/components/ui/modal/Modal.svelte';

  let {
    flights = $bindable(),
    filters = $bindable(),
    tempFilters = $bindable(),
    hasTempFilters = false,
    layout = 'default',
    presentation = 'default',
  }: {
    flights: FlightData[];
    filters: FlightFilters;
    tempFilters?: TempFilters;
    hasTempFilters?: boolean;
    layout?: 'default' | 'stacked';
    presentation?: 'default' | 'map-popover';
  } = $props();

  type OptionSource = {
    value: string;
    label: string;
    shortLabel?: string;
    count?: number;
    icon?: FilterIcon;
  };

  type FilterIconProps = {
    size?: number;
    class?: string;
    'aria-hidden'?: boolean | 'true' | 'false';
  };

  function escapeAttribute(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }

  function airlineIcon(airline: Airline): FilterIcon {
    if (!airline.iconPath) return Airlines;

    const src = escapeAttribute(`/api/uploads/${airline.iconPath}`);
    const title = escapeAttribute(airline.name);

    return createRawSnippet(() => ({
      render: () =>
        `<img data-filter-airline-icon src="${src}" alt="" title="${title}" loading="lazy" decoding="async" />`,
    }));
  }

  function airportFlagIcon(airport: Airport): FilterIcon {
    const country = airport.country?.toLowerCase();
    if (!country) return Plane;

    const code = escapeAttribute(country);
    const title = escapeAttribute(airport.country.toUpperCase());

    return createRawSnippet(() => ({
      render: () =>
        `<img data-filter-airport-flag-icon src="https://flagcdn.com/${code}.svg" alt="" title="${title}" loading="lazy" decoding="async" />`,
    }));
  }

  function passengerAvatarIcon(username: string): FilterIcon {
    const Icon: Component<FilterIconProps> = (internals, props) =>
      UserAvatar(internals, {
        ...props,
        username,
        size: props.size ?? 16,
        animated: false,
        class: cn('airtrail-filter-user-avatar', props.class),
      });

    return Icon;
  }

  const tempLocationFiltersActive = $derived(
    hasTempFilters ||
      !!(
        tempFilters &&
        (tempFilters.departureAirports.length ||
          tempFilters.arrivalAirports.length ||
          tempFilters.airportsEither.length ||
          tempFilters.routes.length)
      ),
  );
  const modalCtx = getModalContext();
  const filterContentZIndex = $derived.by(() => {
    const modalZ = modalCtx?.getContentZIndex();
    return modalZ !== undefined ? `${modalZ + 5}` : undefined;
  });

  $effect(() => {
    if (!filterContentZIndex) return;
    return pushFilterContentZIndex(filterContentZIndex);
  });

  function createFlightFilters(): FlightFilters {
    return {
      departureAirports: [],
      departureAirportsOperator: 'is any of',
      arrivalAirports: [],
      arrivalAirportsOperator: 'is any of',
      airportsEither: [],
      routes: [],
      years: [],
      yearsOperator: 'is any of',
      fromDate: undefined,
      toDate: undefined,
      passengers: [],
      passengersOperator: 'include any of',
      airline: [],
      airlineOperator: 'is any of',
      aircraft: [],
      aircraftOperator: 'is any of',
      aircraftRegs: [],
      aircraftRegsOperator: 'is any of',
    };
  }

  const uniqueAirports = (
    sourceFlights: FlightData[],
    airportSelector: (flight: FlightData) => Airport | null,
  ) => {
    const seen = new Set<string>();
    return sourceFlights
      .map(airportSelector)
      .filter((airport): airport is Airport => !!airport)
      .filter((airport) => {
        const id = airport.id.toString();
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .map((airport) => ({
        value: airport.id.toString(),
        label: `${airport.iata ?? airport.icao} | ${airport.name}`,
        shortLabel: airport.iata ?? airport.icao,
        icon: airportFlagIcon(airport),
      }));
  };

  function columnOptions(options: OptionSource[]) {
    return options;
  }

  const departureAirports = $derived.by(() => {
    return uniqueAirports(flights ?? [], (flight) => flight.from);
  });

  const arrivalAirports = $derived.by(() => {
    return uniqueAirports(flights ?? [], (flight) => flight.to);
  });

  const passengerOptions = $derived.by(() => {
    const options = new Map<string, OptionSource>();

    for (const flight of flights ?? []) {
      for (const seat of flight.seats) {
        const value = getSeatPassengerToken(seat);
        const label = getSeatPassengerLabel(seat);

        if (!value || !label) continue;

        const existing = options.get(value);
        if (existing) {
          existing.count = (existing.count ?? 0) + 1;
        } else {
          options.set(value, {
            value,
            label,
            count: 1,
            icon: passengerAvatarIcon(
              seat.user?.username ?? `guest:${seat.guestName ?? label}`,
            ),
          });
        }
      }
    }

    return Array.from(options.values()).sort(
      (a, b) =>
        (b.count ?? 0) - (a.count ?? 0) || a.label.localeCompare(b.label),
    );
  });

  const airlineOptions = $derived.by(() => {
    const frequencyMap = new Map<
      string,
      {
        airline: Airline;
        count: number;
      }
    >();

    for (const flight of flights ?? []) {
      if (!flight.airline) continue;
      const existing = frequencyMap.get(flight.airline.name);
      if (existing) {
        existing.count += 1;
      } else {
        frequencyMap.set(flight.airline.name, {
          airline: flight.airline,
          count: 1,
        });
      }
    }

    return Array.from(frequencyMap.values())
      .map(({ airline, count }) => ({
        value: airline.name,
        label: airline.name,
        count,
        icon: airlineIcon(airline),
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  });

  const aircraftOptions = $derived.by(() => {
    const frequencyMap = new Map<string, number>();

    for (const flight of flights ?? []) {
      if (!flight.aircraft) continue;
      frequencyMap.set(
        flight.aircraft.name,
        (frequencyMap.get(flight.aircraft.name) ?? 0) + 1,
      );
    }

    return Array.from(frequencyMap.entries())
      .map(([aircraft, count]) => ({
        value: aircraft,
        label: aircraft,
        count,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  });

  const aircraftRegOptions = $derived.by(() => {
    const frequencyMap = new Map<string, number>();

    for (const flight of flights ?? []) {
      if (!flight.aircraftReg) continue;
      frequencyMap.set(
        flight.aircraftReg,
        (frequencyMap.get(flight.aircraftReg) ?? 0) + 1,
      );
    }

    return Array.from(frequencyMap.entries())
      .map(([registration, count]) => ({
        value: registration,
        label: registration,
        count,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  });

  const yearOptions = $derived.by(() => {
    const years = new Set<string>();

    for (const flight of flights ?? []) {
      if (flight.date) {
        years.add(flight.date.getFullYear().toString());
      }
    }

    return Array.from(years)
      .sort((a, b) => b.localeCompare(a))
      .map((year) => ({
        value: year,
        label: year,
      }));
  });

  const columnsConfig = $derived.by(() => {
    return [
      {
        id: 'departureAirports',
        displayName: 'Departure Airport',
        type: 'option',
        accessor: (flight) => flight.from?.id.toString() ?? '',
        icon: PlaneTakeoff,
        options: columnOptions(departureAirports),
        hidden: tempLocationFiltersActive,
      },
      {
        id: 'arrivalAirports',
        displayName: 'Arrival Airport',
        type: 'option',
        accessor: (flight) => flight.to?.id.toString() ?? '',
        icon: PlaneLanding,
        options: columnOptions(arrivalAirports),
        hidden: tempLocationFiltersActive,
      },
      {
        id: 'year',
        displayName: 'Year',
        type: 'option',
        accessor: (flight) => flight.date?.getFullYear().toString() ?? '',
        icon: Calendar,
        options: yearOptions,
      },
      {
        id: 'date',
        displayName: 'Date',
        type: 'date',
        accessor: (flight) =>
          flight.date ?? flight.dateStart ?? flight.dateEnd ?? new Date(),
        icon: Calendar,
      },
      {
        id: 'passengers',
        displayName: 'Passenger',
        type: 'multiOption',
        accessor: (flight) =>
          flight.seats
            .map((seat) => getSeatPassengerToken(seat))
            .filter((value): value is string => !!value),
        icon: UsersRound,
        options: columnOptions(passengerOptions),
      },
      {
        id: 'airline',
        displayName: 'Airline',
        type: 'option',
        accessor: (flight) => flight.airline?.name ?? '',
        icon: Airlines,
        options: columnOptions(airlineOptions),
      },
      {
        id: 'aircraft',
        displayName: 'Aircraft',
        type: 'option',
        accessor: (flight) => flight.aircraft?.name ?? '',
        icon: Plane,
        options: columnOptions(aircraftOptions),
      },
      {
        id: 'aircraftRegs',
        displayName: 'Tail Number',
        type: 'option',
        accessor: (flight) => flight.aircraftReg ?? '',
        icon: Hash,
        options: columnOptions(aircraftRegOptions),
      },
    ] satisfies ReadonlyArray<ColumnConfig<FlightData, any, any, any>>;
  });

  function calendarDateToDate(value: CalendarDate) {
    return new Date(value.year, value.month - 1, value.day);
  }

  function dateToCalendarDate(value: Date) {
    return new CalendarDate(
      value.getFullYear(),
      value.getMonth() + 1,
      value.getDate(),
    );
  }

  function isSameCalendarDate(a: CalendarDate, b: CalendarDate) {
    return a.compare(b) === 0;
  }

  function isFullYearRange(fromDate?: CalendarDate, toDate?: CalendarDate) {
    if (!fromDate || !toDate || fromDate.year !== toDate.year) return false;
    return (
      fromDate.month === 1 &&
      fromDate.day === 1 &&
      toDate.month === 12 &&
      toDate.day === 31
    );
  }

  function stringValues(filter: FilterModel) {
    return filter.values
      .map((value) => (typeof value === 'string' ? value : undefined))
      .filter((value): value is string => !!value);
  }

  function firstDateValue(filter: FilterModel) {
    const value = filter.values[0];
    return value instanceof Date ? dateToCalendarDate(value) : undefined;
  }

  function normalizeDateRange(fromDate: CalendarDate, toDate: CalendarDate) {
    return fromDate.compare(toDate) <= 0
      ? [fromDate, toDate]
      : [toDate, fromDate];
  }

  function optionFilter(
    columnId: string,
    values: string[],
    operator: OptionFilterOperator = values.length > 1 ? 'is any of' : 'is',
  ): FilterModel<'option'> | undefined {
    if (!values.length) return undefined;
    return {
      columnId,
      type: 'option',
      operator,
      values,
    };
  }

  function normalizeOptionOperator(
    operator: OptionFilterOperator,
    valueCount: number,
  ): OptionFilterOperator {
    if (valueCount > 1) {
      if (operator === 'is') return 'is any of';
      if (operator === 'is not') return 'is none of';
      return operator;
    }

    if (operator === 'is any of') return 'is';
    if (operator === 'is none of') return 'is not';
    return operator;
  }

  function multiOptionFilter(
    columnId: string,
    values: string[],
    operator: MultiOptionFilterOperator = values.length > 1
      ? 'include any of'
      : 'include',
  ): FilterModel<'multiOption'> | undefined {
    if (!values.length) return undefined;
    return {
      columnId,
      type: 'multiOption',
      operator,
      values,
    };
  }

  function dateFilterFromFlightFilters(
    source: FlightFilters,
  ): FilterModel<'date'> | FilterModel<'option'> | undefined {
    if (source.years.length) {
      return {
        columnId: 'year',
        type: 'option',
        operator: source.yearsOperator,
        values: source.years,
      };
    }

    if (isFullYearRange(source.fromDate, source.toDate)) {
      return {
        columnId: 'year',
        type: 'option',
        operator: 'is',
        values: [source.fromDate.year.toString()],
      };
    }

    if (source.fromDate && source.toDate) {
      const [fromDate, toDate] = normalizeDateRange(
        source.fromDate,
        source.toDate,
      );

      if (isSameCalendarDate(fromDate, toDate)) {
        return {
          columnId: 'date',
          type: 'date',
          operator: 'is',
          values: [calendarDateToDate(fromDate)],
        };
      }

      return {
        columnId: 'date',
        type: 'date',
        operator: 'is between',
        values: [calendarDateToDate(fromDate), calendarDateToDate(toDate)],
      };
    }

    if (source.fromDate) {
      return {
        columnId: 'date',
        type: 'date',
        operator: 'is on or after',
        values: [calendarDateToDate(source.fromDate)],
      };
    }

    if (source.toDate) {
      return {
        columnId: 'date',
        type: 'date',
        operator: 'is on or before',
        values: [calendarDateToDate(source.toDate)],
      };
    }
  }

  function flightFiltersToBits(source: FlightFilters): FiltersState {
    const nextFilters: FiltersState = [];

    for (const filter of [
      optionFilter(
        'departureAirports',
        source.departureAirports,
        source.departureAirportsOperator,
      ),
      optionFilter(
        'arrivalAirports',
        source.arrivalAirports,
        source.arrivalAirportsOperator,
      ),
      dateFilterFromFlightFilters(source),
      multiOptionFilter(
        'passengers',
        source.passengers,
        source.passengersOperator,
      ),
      optionFilter('airline', source.airline, source.airlineOperator),
      optionFilter('aircraft', source.aircraft, source.aircraftOperator),
      optionFilter(
        'aircraftRegs',
        source.aircraftRegs,
        source.aircraftRegsOperator,
      ),
    ]) {
      if (filter) nextFilters.push(filter);
    }

    return nextFilters;
  }

  function applyDateFilter(target: FlightFilters, filter: FilterModel) {
    if (filter.columnId === 'year') {
      const year = Number.parseInt(stringValues(filter)[0] ?? '', 10);
      if (!Number.isFinite(year)) return;

      target.fromDate = new CalendarDate(year, 1, 1);
      target.toDate = new CalendarDate(year, 12, 31);
      return;
    }

    if (filter.columnId !== 'date') return;

    const firstDate = firstDateValue(filter);
    const secondValue = filter.values[1];
    const secondDate =
      secondValue instanceof Date ? dateToCalendarDate(secondValue) : undefined;

    if (!firstDate) return;

    switch (filter.operator) {
      case 'is':
        target.fromDate = firstDate;
        target.toDate = firstDate;
        break;
      case 'is before':
        target.toDate = firstDate.subtract({ days: 1 });
        break;
      case 'is on or before':
        target.toDate = firstDate;
        break;
      case 'is after':
        target.fromDate = firstDate.add({ days: 1 });
        break;
      case 'is on or after':
        target.fromDate = firstDate;
        break;
      case 'is between':
        if (secondDate) {
          const [fromDate, toDate] = normalizeDateRange(firstDate, secondDate);
          target.fromDate = fromDate;
          target.toDate = toDate;
        }
        break;
    }
  }

  function bitsFiltersToFlightFilters(source: FiltersState): FlightFilters {
    const nextFilters = createFlightFilters();
    const dateFilters: FilterModel[] = [];

    for (const filter of source) {
      switch (filter.columnId) {
        case 'departureAirports':
          nextFilters.departureAirports = stringValues(filter);
          nextFilters.departureAirportsOperator =
            filter.operator as OptionFilterOperator;
          break;
        case 'arrivalAirports':
          nextFilters.arrivalAirports = stringValues(filter);
          nextFilters.arrivalAirportsOperator =
            filter.operator as OptionFilterOperator;
          break;
        case 'passengers':
          nextFilters.passengers = stringValues(filter);
          nextFilters.passengersOperator =
            filter.operator as MultiOptionFilterOperator;
          break;
        case 'airline':
          nextFilters.airline = stringValues(filter);
          nextFilters.airlineOperator = filter.operator as OptionFilterOperator;
          break;
        case 'aircraft':
          nextFilters.aircraft = stringValues(filter);
          nextFilters.aircraftOperator =
            filter.operator as OptionFilterOperator;
          break;
        case 'aircraftRegs':
          nextFilters.aircraftRegs = stringValues(filter);
          nextFilters.aircraftRegsOperator =
            filter.operator as OptionFilterOperator;
          break;
        case 'year':
          nextFilters.years = stringValues(filter);
          nextFilters.yearsOperator = normalizeOptionOperator(
            filter.operator as OptionFilterOperator,
            nextFilters.years.length,
          );
          break;
        case 'date':
          dateFilters.push(filter);
          break;
      }
    }

    dateFilters
      .sort((a) => (a.columnId === 'year' ? -1 : 1))
      .forEach((filter) => applyDateFilter(nextFilters, filter));

    return nextFilters;
  }

  function serializeFilterValue(value: unknown) {
    if (value instanceof Date) {
      return `${value.getFullYear()}-${value.getMonth() + 1}-${value.getDate()}`;
    }

    return String(value);
  }

  function bitsSignature(source: FiltersState) {
    return JSON.stringify(
      source.map((filter) => ({
        columnId: filter.columnId,
        type: filter.type,
        operator: filter.operator,
        values: filter.values.map(serializeFilterValue),
      })),
    );
  }

  function flightSignature(source: FlightFilters) {
    return JSON.stringify({
      departureAirports: source.departureAirports,
      departureAirportsOperator: source.departureAirportsOperator,
      arrivalAirports: source.arrivalAirports,
      arrivalAirportsOperator: source.arrivalAirportsOperator,
      years: source.years,
      yearsOperator: source.yearsOperator,
      fromDate: source.fromDate?.toString(),
      toDate: source.toDate?.toString(),
      passengers: source.passengers,
      passengersOperator: source.passengersOperator,
      airline: source.airline,
      airlineOperator: source.airlineOperator,
      aircraft: source.aircraft,
      aircraftOperator: source.aircraftOperator,
      aircraftRegs: source.aircraftRegs,
      aircraftRegsOperator: source.aircraftRegsOperator,
    });
  }

  const filterState = useDataTableFilters({
    strategy: 'client',
    data: flights,
    columnsConfig,
    entityName: 'Flight',
    defaultFilters: flightFiltersToBits(filters),
  });

  let lastSyncedBitsSignature = $state(bitsSignature(filterState.filters));
  let lastSyncedFlightSignature = $state(flightSignature(filters));

  $effect(() => {
    const currentBitsSignature = bitsSignature(filterState.filters);
    if (currentBitsSignature === lastSyncedBitsSignature) return;

    lastSyncedBitsSignature = currentBitsSignature;
    filters = bitsFiltersToFlightFilters(filterState.filters);
    lastSyncedFlightSignature = flightSignature(filters);
  });

  $effect(() => {
    const currentFlightSignature = flightSignature(filters);
    if (currentFlightSignature === lastSyncedFlightSignature) return;

    lastSyncedFlightSignature = currentFlightSignature;
  });

  const providerColumns = $derived(filterState.columns as any);
</script>

<Filter.Provider
  columns={providerColumns}
  filters={filterState.filters}
  actions={filterState.actions}
  strategy={filterState.strategy}
  entityName="Flight"
  variant="clean"
>
  <Filter.Root
    class="airtrail-filter-root"
    data-filter-layout={layout}
    data-filter-presentation={presentation}
  >
    {#if layout === 'stacked'}
      <div class="airtrail-filter-toolbar">
        {@render filterMenu()}
        {@render filterActions()}
      </div>
      {@render filterList()}
    {:else}
      <div class="airtrail-filter-stack">
        {@render filterMenu()}
        {@render filterList()}
        {@render filterActions()}
      </div>
    {/if}
  </Filter.Root>
</Filter.Provider>

{#snippet filterMenu()}
  <Filter.Menu>
    <Funnel size={16} aria-hidden="true" />
    {#if filterState.filters.length === 0 || layout === 'stacked'}
      <span>Filter</span>
    {:else}
      <span class="sr-only">Filter</span>
    {/if}
  </Filter.Menu>
{/snippet}

{#snippet filterList()}
  <Filter.List>
    {#snippet children({ filter, column })}
      <Filter.Item {filter} {column}>
        <Filter.Subject />
        <Filter.Operator />
        <Filter.Value />
        <Filter.Remove aria-label={`Remove ${column.displayName} filter`}>
          <X size={16} aria-hidden="true" />
        </Filter.Remove>
      </Filter.Item>
    {/snippet}
  </Filter.List>
{/snippet}

{#snippet filterActions()}
  <Filter.Actions>
    <X size={14} aria-hidden="true" />
    <span>Clear</span>
  </Filter.Actions>
{/snippet}
