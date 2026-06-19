<script lang="ts">
  import { CalendarDate, type DateValue } from '@internationalized/date';
  import {
    Calendar as CalendarIcon,
    Check,
    ChevronLeft,
    ChevronRight,
    Hash,
    Plane,
    PlaneLanding,
    PlaneTakeoff,
    Search,
    UsersRound,
    X,
    Plus,
  } from '@o7/icon';
  import { Airlines } from '@o7/icon/material';
  import { DateRangePicker } from 'bits-ui';
  import type { Component } from 'svelte';

  import UserAvatar from '$lib/components/display/UserAvatar.svelte';
  import {
    defaultFilters,
    hasTempFilters as hasActiveTempFilters,
    type FlightFilters,
    type MultiOptionFilterOperator,
    type OptionFilterOperator,
    type TempFilters,
  } from '$lib/components/flight-filters/types';
  import AnimatedSizeContainer from '$lib/components/ui/animated-size-container.svelte';
  import { Button } from '$lib/components/ui/button';
  import * as CalendarParts from '$lib/components/ui/calendar';
  import {
    Modal,
    ModalBody,
    ModalFooter,
    ModalHeader,
  } from '$lib/components/ui/modal';
  import {
    cn,
    getSeatPassengerLabel,
    getSeatPassengerToken,
    type FlightData,
  } from '$lib/utils';

  type FilterColumnId =
    | 'departureAirports'
    | 'arrivalAirports'
    | 'date'
    | 'passengers'
    | 'airline'
    | 'aircraft'
    | 'aircraftRegs';

  type OptionColumnId = Exclude<FilterColumnId, 'date'>;
  type Screen =
    | { kind: 'home' }
    | { kind: 'subjects' }
    | { kind: 'filter'; columnId: OptionColumnId }
    | { kind: 'date' };

  type FilterColumn = {
    id: FilterColumnId;
    label: string;
    icon: Component<{ size?: number; class?: string; 'aria-hidden'?: boolean }>;
    type: 'option' | 'multiOption' | 'date';
    hidden?: boolean;
  };

  type FilterOption = {
    value: string;
    label: string;
    shortLabel?: string;
    count?: number;
    kind?: 'airport' | 'airline' | 'passenger';
    country?: string | null;
    iconPath?: string | null;
    username?: string;
  };

  const optionOperators: Array<{ value: OptionFilterOperator; label: string }> =
    [
      { value: 'is', label: 'Is' },
      { value: 'is not', label: 'Is not' },
      { value: 'is any of', label: 'Is any of' },
      { value: 'is none of', label: 'Is none of' },
    ];
  const singularOptionOperators = optionOperators.filter(
    (operator) => operator.value === 'is' || operator.value === 'is not',
  );
  const pluralOptionOperators = optionOperators.filter(
    (operator) =>
      operator.value === 'is any of' || operator.value === 'is none of',
  );

  const multiOptionOperators: Array<{
    value: MultiOptionFilterOperator;
    label: string;
  }> = [
    { value: 'include', label: 'Include' },
    { value: 'exclude', label: 'Exclude' },
    { value: 'include any of', label: 'Include any of' },
    { value: 'include all of', label: 'Include all of' },
    { value: 'exclude if any of', label: 'Exclude if any of' },
    { value: 'exclude if all', label: 'Exclude if all' },
  ];
  const singularMultiOptionOperators = multiOptionOperators.filter(
    (operator) => operator.value === 'include' || operator.value === 'exclude',
  );
  const pluralMultiOptionOperators = multiOptionOperators.filter(
    (operator) => operator.value !== 'include' && operator.value !== 'exclude',
  );

  let {
    open = $bindable(),
    flights,
    filters = $bindable(),
    tempFilters,
    hasTempFilters = false,
  }: {
    open: boolean;
    flights: FlightData[];
    filters: FlightFilters;
    tempFilters?: TempFilters;
    hasTempFilters?: boolean;
  } = $props();

  let screen = $state<Screen>({ kind: 'home' });
  let search = $state('');
  let wasOpen = $state(open);
  let calendarPlaceholder = $state<DateValue | undefined>(undefined);
  let calendarMode = $state<'normal' | 'year' | 'month'>('normal');

  const tempLocationFiltersActive = $derived(
    hasTempFilters || hasActiveTempFilters(tempFilters),
  );

  const columns = $derived<FilterColumn[]>([
    {
      id: 'departureAirports',
      label: 'Departure Airport',
      icon: PlaneTakeoff,
      type: 'option',
      hidden: tempLocationFiltersActive,
    },
    {
      id: 'arrivalAirports',
      label: 'Arrival Airport',
      icon: PlaneLanding,
      type: 'option',
      hidden: tempLocationFiltersActive,
    },
    { id: 'date', label: 'Date', icon: CalendarIcon, type: 'date' },
    {
      id: 'passengers',
      label: 'Passenger',
      icon: UsersRound,
      type: 'multiOption',
    },
    { id: 'airline', label: 'Airline', icon: Airlines, type: 'option' },
    { id: 'aircraft', label: 'Aircraft', icon: Plane, type: 'option' },
    { id: 'aircraftRegs', label: 'Tail Number', icon: Hash, type: 'option' },
  ]);

  const visibleColumns = $derived(columns.filter((column) => !column.hidden));

  function cloneFilters(next: Partial<FlightFilters> = {}) {
    filters = {
      ...filters,
      departureAirports: [...filters.departureAirports],
      arrivalAirports: [...filters.arrivalAirports],
      airportsEither: [...filters.airportsEither],
      routes: [...filters.routes],
      years: [...filters.years],
      passengers: [...filters.passengers],
      airline: [...filters.airline],
      aircraft: [...filters.aircraft],
      aircraftRegs: [...filters.aircraftRegs],
      ...next,
    };
  }

  function resetNavigation() {
    screen = { kind: 'home' };
    search = '';
  }

  function go(next: Screen) {
    screen = next;
    search = '';
  }

  function back() {
    if (screen.kind === 'home') return;
    if (screen.kind === 'subjects') {
      go({ kind: 'home' });
      return;
    }
    go({ kind: 'home' });
  }

  function columnById(columnId: FilterColumnId) {
    return columns.find((column) => column.id === columnId);
  }

  function uniqueAirportOptions(
    selector: (flight: FlightData) => FlightData['from'],
  ) {
    const options = new Map<string, FilterOption>();
    for (const flight of flights ?? []) {
      const airport = selector(flight);
      if (!airport) continue;
      const value = airport.id.toString();
      const existing = options.get(value);
      if (existing) {
        existing.count = (existing.count ?? 0) + 1;
      } else {
        options.set(value, {
          value,
          label: `${airport.iata ?? airport.icao} | ${airport.name}`,
          shortLabel: airport.iata ?? airport.icao,
          count: 1,
          kind: 'airport',
          country: airport.country,
        });
      }
    }
    return sortOptions(Array.from(options.values()));
  }

  function countedOptions(
    values: Array<FilterOption | undefined | null>,
    key = (option: FilterOption) => option.value,
  ) {
    const options = new Map<string, FilterOption>();
    for (const option of values) {
      if (!option) continue;
      const id = key(option);
      const existing = options.get(id);
      if (existing) {
        existing.count = (existing.count ?? 0) + 1;
      } else {
        options.set(id, { ...option, count: option.count ?? 1 });
      }
    }
    return sortOptions(Array.from(options.values()));
  }

  function sortOptions(options: FilterOption[]) {
    return options.sort(
      (a, b) =>
        (b.count ?? 0) - (a.count ?? 0) || a.label.localeCompare(b.label),
    );
  }

  const optionsByColumn = $derived.by(() => {
    const passengers = new Map<string, FilterOption>();

    for (const flight of flights ?? []) {
      for (const seat of flight.seats) {
        const value = getSeatPassengerToken(seat);
        const label = getSeatPassengerLabel(seat);
        if (!value || !label) continue;
        const existing = passengers.get(value);
        if (existing) {
          existing.count = (existing.count ?? 0) + 1;
        } else {
          passengers.set(value, {
            value,
            label,
            count: 1,
            kind: 'passenger',
            username: seat.user?.username ?? `guest:${seat.guestName ?? label}`,
          });
        }
      }
    }

    return {
      departureAirports: uniqueAirportOptions((flight) => flight.from),
      arrivalAirports: uniqueAirportOptions((flight) => flight.to),
      passengers: sortOptions(Array.from(passengers.values())),
      airline: countedOptions(
        (flights ?? []).map((flight) =>
          flight.airline
            ? {
                value: flight.airline.name,
                label: flight.airline.name,
                kind: 'airline',
                iconPath: flight.airline.iconPath,
              }
            : null,
        ),
      ),
      aircraft: countedOptions(
        (flights ?? []).map((flight) =>
          flight.aircraft
            ? { value: flight.aircraft.name, label: flight.aircraft.name }
            : null,
        ),
      ),
      aircraftRegs: countedOptions(
        (flights ?? []).map((flight) =>
          flight.aircraftReg
            ? { value: flight.aircraftReg, label: flight.aircraftReg }
            : null,
        ),
      ),
    } satisfies Record<OptionColumnId, FilterOption[]>;
  });

  function valuesFor(columnId: OptionColumnId) {
    return filters[columnId];
  }

  function operatorFor(columnId: OptionColumnId) {
    switch (columnId) {
      case 'passengers':
        return normalizeMultiOptionOperator(
          filters.passengersOperator,
          valuesFor(columnId).length,
        );
      case 'departureAirports':
        return normalizeOptionOperator(
          filters.departureAirportsOperator,
          valuesFor(columnId).length,
        );
      case 'arrivalAirports':
        return normalizeOptionOperator(
          filters.arrivalAirportsOperator,
          valuesFor(columnId).length,
        );
      case 'airline':
        return normalizeOptionOperator(
          filters.airlineOperator,
          valuesFor(columnId).length,
        );
      case 'aircraft':
        return normalizeOptionOperator(
          filters.aircraftOperator,
          valuesFor(columnId).length,
        );
      case 'aircraftRegs':
        return normalizeOptionOperator(
          filters.aircraftRegsOperator,
          valuesFor(columnId).length,
        );
    }
  }

  function rawOperatorFor(columnId: OptionColumnId) {
    switch (columnId) {
      case 'passengers':
        return filters.passengersOperator;
      case 'departureAirports':
        return filters.departureAirportsOperator;
      case 'arrivalAirports':
        return filters.arrivalAirportsOperator;
      case 'airline':
        return filters.airlineOperator;
      case 'aircraft':
        return filters.aircraftOperator;
      case 'aircraftRegs':
        return filters.aircraftRegsOperator;
    }
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

  function normalizeMultiOptionOperator(
    operator: MultiOptionFilterOperator,
    valueCount: number,
  ): MultiOptionFilterOperator {
    if (valueCount > 1) {
      if (operator === 'include') return 'include any of';
      if (operator === 'exclude') return 'exclude if any of';
      return operator;
    }

    if (operator === 'exclude if any of' || operator === 'exclude if all') {
      return 'exclude';
    }

    if (operator === 'include any of' || operator === 'include all of') {
      return 'include';
    }

    return operator;
  }

  function normalizeOperatorForCount(
    columnId: OptionColumnId,
    valueCount = valuesFor(columnId).length,
  ) {
    const operator = rawOperatorFor(columnId);
    return columnId === 'passengers'
      ? normalizeMultiOptionOperator(
          operator as MultiOptionFilterOperator,
          valueCount,
        )
      : normalizeOptionOperator(operator as OptionFilterOperator, valueCount);
  }

  function setOperator(columnId: OptionColumnId, operator: string) {
    switch (columnId) {
      case 'passengers':
        cloneFilters({
          passengersOperator: operator as MultiOptionFilterOperator,
        });
        break;
      case 'departureAirports':
        cloneFilters({
          departureAirportsOperator: operator as OptionFilterOperator,
        });
        break;
      case 'arrivalAirports':
        cloneFilters({
          arrivalAirportsOperator: operator as OptionFilterOperator,
        });
        break;
      case 'airline':
        cloneFilters({ airlineOperator: operator as OptionFilterOperator });
        break;
      case 'aircraft':
        cloneFilters({ aircraftOperator: operator as OptionFilterOperator });
        break;
      case 'aircraftRegs':
        cloneFilters({
          aircraftRegsOperator: operator as OptionFilterOperator,
        });
        break;
    }
  }

  function operatorPatch(columnId: OptionColumnId, operator: string) {
    switch (columnId) {
      case 'passengers':
        return { passengersOperator: operator as MultiOptionFilterOperator };
      case 'departureAirports':
        return { departureAirportsOperator: operator as OptionFilterOperator };
      case 'arrivalAirports':
        return { arrivalAirportsOperator: operator as OptionFilterOperator };
      case 'airline':
        return { airlineOperator: operator as OptionFilterOperator };
      case 'aircraft':
        return { aircraftOperator: operator as OptionFilterOperator };
      case 'aircraftRegs':
        return { aircraftRegsOperator: operator as OptionFilterOperator };
    }
  }

  function setValues(columnId: OptionColumnId, values: string[]) {
    cloneFilters({
      [columnId]: values,
      ...operatorPatch(
        columnId,
        normalizeOperatorForCount(columnId, values.length),
      ),
    } as Partial<FlightFilters>);
  }

  function toggleValue(columnId: OptionColumnId, value: string) {
    const currentValues = valuesFor(columnId);
    const nextValues = currentValues.includes(value)
      ? currentValues.filter((item) => item !== value)
      : [...currentValues, value];
    setValues(columnId, nextValues);
  }

  function clearColumn(columnId: FilterColumnId) {
    switch (columnId) {
      case 'date':
        cloneFilters({ years: [], fromDate: undefined, toDate: undefined });
        break;
      default:
        setValues(columnId, []);
        break;
    }
  }

  function isColumnActive(columnId: FilterColumnId) {
    if (columnId === 'date')
      return !!(filters.years.length || filters.fromDate || filters.toDate);
    return valuesFor(columnId).length > 0;
  }

  const activeColumns = $derived(
    visibleColumns.filter((column) => isColumnActive(column.id)),
  );

  $effect(() => {
    if (open && !wasOpen) {
      screen =
        activeColumns.length === 0 && !tempLocationFiltersActive
          ? { kind: 'subjects' }
          : { kind: 'home' };
      search = '';
    } else if (!open && wasOpen) {
      resetNavigation();
    }

    wasOpen = open;
  });

  function formatDateLabel(value: CalendarDate | undefined) {
    if (!value) return '';
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(value.year, value.month - 1, value.day));
  }

  function dateSummary() {
    if (filters.years.length) {
      if (filters.years.length <= 2) return filters.years.join(', ');
      return `${filters.years.slice(0, 2).join(', ')} +${filters.years.length - 2}`;
    }

    if (filters.fromDate && filters.toDate) {
      if (filters.fromDate.compare(filters.toDate) === 0) {
        return formatDateLabel(filters.fromDate);
      }
      return `${formatDateLabel(filters.fromDate)} - ${formatDateLabel(filters.toDate)}`;
    }
    if (filters.fromDate) return `From ${formatDateLabel(filters.fromDate)}`;
    if (filters.toDate) return `Until ${formatDateLabel(filters.toDate)}`;
    return 'Choose date';
  }

  function setDateMode(mode: 'single' | 'range' | 'from' | 'to') {
    const today = new CalendarDate(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      new Date().getDate(),
    );
    const anchor = filters.fromDate ?? filters.toDate ?? today;

    if (mode === 'single') {
      cloneFilters({ years: [], fromDate: anchor, toDate: anchor });
    } else if (mode === 'range') {
      cloneFilters({
        years: [],
        fromDate: filters.fromDate ?? anchor,
        toDate: filters.toDate ?? anchor,
      });
    } else if (mode === 'from') {
      cloneFilters({ years: [], fromDate: anchor, toDate: undefined });
    } else {
      cloneFilters({ years: [], fromDate: undefined, toDate: anchor });
    }
  }

  function dateMode() {
    if (filters.fromDate && filters.toDate) {
      return filters.fromDate.compare(filters.toDate) === 0
        ? 'single'
        : 'range';
    }
    if (filters.fromDate) return 'from';
    if (filters.toDate) return 'to';
    return 'single';
  }

  function setThisYear() {
    const year = new Date().getFullYear();
    cloneFilters({
      years: [],
      fromDate: new CalendarDate(year, 1, 1),
      toDate: new CalendarDate(year, 12, 31),
    });
  }

  const dateRangeValue = $derived.by(() => ({
    start: filters.fromDate,
    end:
      filters.fromDate && filters.toDate?.compare(filters.fromDate) === 0
        ? undefined
        : filters.toDate,
  }));

  $effect(() => {
    const anchor = filters.fromDate ?? filters.toDate;
    if (anchor && !calendarPlaceholder) calendarPlaceholder = anchor;
  });

  function handleDateRangeChange(
    value:
      | { start: DateValue | undefined; end: DateValue | undefined }
      | undefined,
  ) {
    const start = value?.start as CalendarDate | undefined;
    const end = value?.end as CalendarDate | undefined;
    const mode = dateMode();

    if (!start && !end) {
      cloneFilters({ years: [], fromDate: undefined, toDate: undefined });
      return;
    }

    const anchor = start ?? end;
    if (anchor) calendarPlaceholder = anchor;

    if (mode === 'single') {
      cloneFilters({ years: [], fromDate: anchor, toDate: anchor });
    } else if (mode === 'from') {
      cloneFilters({ years: [], fromDate: anchor, toDate: undefined });
    } else if (mode === 'to') {
      cloneFilters({ years: [], fromDate: undefined, toDate: anchor });
    } else {
      cloneFilters({
        years: [],
        fromDate: start,
        toDate: end ?? start,
      });
    }
  }

  function selectedOptions(columnId: OptionColumnId) {
    const optionMap = new Map(
      optionsByColumn[columnId].map((option) => [option.value, option]),
    );
    return valuesFor(columnId).map(
      (value) =>
        optionMap.get(value)?.shortLabel ??
        optionMap.get(value)?.label ??
        value,
    );
  }

  function selectedOptionObjects(columnId: OptionColumnId) {
    const optionMap = new Map(
      optionsByColumn[columnId].map((option) => [option.value, option]),
    );
    return valuesFor(columnId)
      .map((value) => optionMap.get(value))
      .filter((option): option is FilterOption => !!option);
  }

  function valueSummary(columnId: FilterColumnId) {
    if (columnId === 'date') return dateSummary();
    const labels = selectedOptions(columnId);
    if (!labels.length) return 'Choose values';
    if (labels.length <= 2) return labels.join(', ');
    return `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`;
  }

  function activeFilterSummary(column: FilterColumn) {
    if (column.id === 'date') return dateSummary();
    return `${operatorFor(column.id)} ${valueSummary(column.id)}`;
  }

  function filteredOptions(columnId: OptionColumnId) {
    const query = search.trim().toLowerCase();
    if (!query) return optionsByColumn[columnId];
    return optionsByColumn[columnId].filter(
      (option) =>
        option.label.toLowerCase().includes(query) ||
        option.value.toLowerCase().includes(query) ||
        option.shortLabel?.toLowerCase().includes(query),
    );
  }

  function optionCount(columnId: OptionColumnId) {
    return valuesFor(columnId).length;
  }

  function operatorsFor(columnId: OptionColumnId) {
    const hasMultipleValues = valuesFor(columnId).length > 1;
    if (columnId === 'passengers') {
      return hasMultipleValues
        ? pluralMultiOptionOperators
        : singularMultiOptionOperators;
    }

    return hasMultipleValues ? pluralOptionOperators : singularOptionOperators;
  }

  function hasOptionIcon(option: FilterOption) {
    return (
      (option.kind === 'airport' && !!option.country) ||
      (option.kind === 'airline' && !!option.iconPath) ||
      option.kind === 'passenger'
    );
  }

  function clearAll() {
    filters = {
      ...defaultFilters,
      departureAirports: [],
      arrivalAirports: [],
      airportsEither: [],
      routes: [],
      years: [],
      passengers: [],
      airline: [],
      aircraft: [],
      aircraftRegs: [],
    };
  }

  const title = $derived.by(() => {
    if (screen.kind === 'subjects') return 'Add filter';
    if (screen.kind === 'filter')
      return columnById(screen.columnId)?.label ?? 'Filter';
    if (screen.kind === 'date') return 'Date';
    return 'Filters';
  });
</script>

{#snippet optionIcon(option: FilterOption, size = 20)}
  {#if option.kind === 'airport' && option.country}
    <img
      src={`https://flagcdn.com/${option.country.toLowerCase()}.svg`}
      alt=""
      class="h-[calc(var(--mobile-filter-icon-size)*0.72)] w-[var(--mobile-filter-icon-size)] rounded-[2px] object-cover"
      style={`--mobile-filter-icon-size: ${size}px`}
    />
  {:else if option.kind === 'airline' && option.iconPath}
    <img
      src={`/api/uploads/${option.iconPath}`}
      alt=""
      class="size-[var(--mobile-filter-icon-size)] object-contain"
      style={`--mobile-filter-icon-size: ${size}px`}
    />
  {:else if option.kind === 'passenger'}
    <UserAvatar
      username={option.username}
      {size}
      animated={false}
      class="size-[var(--mobile-filter-icon-size)]"
      style={`--mobile-filter-icon-size: ${size}px`}
    />
  {/if}
{/snippet}

{#snippet valueIconStack(columnId: OptionColumnId)}
  {@const selected = selectedOptionObjects(columnId)
    .filter(hasOptionIcon)
    .slice(0, 3)}
  {#if selected.length}
    <span class="flex shrink-0 items-center pl-1">
      {#each selected as option, index (option.value)}
        <span
          class="-ml-1 flex size-5 items-center justify-center overflow-hidden"
          style={`z-index: ${selected.length - index}`}
        >
          {@render optionIcon(option, 16)}
        </span>
      {/each}
    </span>
  {/if}
{/snippet}

<Modal bind:open drawerNoPadding>
  <ModalHeader class="border-b px-4 py-3">
    <div class="flex min-h-9 items-center gap-2">
      {#if screen.kind !== 'home'}
        <Button variant="ghost" size="icon-sm" aria-label="Back" onclick={back}>
          <ChevronRight size={18} class="rotate-180" />
        </Button>
      {/if}
      <h2 class="min-w-0 flex-1 truncate text-base font-semibold">{title}</h2>
      {#if screen.kind === 'home' && activeColumns.length > 0}
        <Button
          variant="ghost"
          size="sm"
          class="px-2 text-muted-foreground"
          onclick={clearAll}
        >
          Clear
        </Button>
      {/if}
    </div>
  </ModalHeader>

  <ModalBody class="overflow-hidden p-0">
    <AnimatedSizeContainer height class="max-h-[72dvh]">
      {#if screen.kind === 'home'}
        <div class="flex max-h-[72dvh] flex-col gap-4 overflow-y-auto p-4">
          <button
            type="button"
            class="flex min-h-14 w-full items-center gap-3 rounded-xl border border-dashed bg-muted/25 p-3 text-left transition-colors active:bg-muted"
            onclick={() => go({ kind: 'subjects' })}
          >
            <span
              class="flex size-9 items-center justify-center rounded-lg bg-background shadow-xs"
            >
              <Plus size={20} />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold">Add filter</span>
              <span class="block text-xs text-muted-foreground">
                Pick a field, operator, and values
              </span>
            </span>
            <ChevronRight size={18} class="text-muted-foreground" />
          </button>

          {#if activeColumns.length}
            <div class="space-y-2">
              {#each activeColumns as column (column.id)}
                <div
                  class="group flex w-full items-center gap-2 rounded-xl border bg-background p-2.5 shadow-xs"
                >
                  <button
                    type="button"
                    class="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition-colors active:bg-muted"
                    onclick={() =>
                      go(
                        column.id === 'date'
                          ? { kind: 'date' }
                          : { kind: 'filter', columnId: column.id },
                      )}
                  >
                    <span
                      class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                    >
                      <column.icon size={17} aria-hidden />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="flex min-w-0 items-center gap-1.5">
                        <span class="truncate text-sm font-semibold">
                          {column.label}
                        </span>
                        {#if column.id !== 'date'}
                          <span
                            class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                          >
                            {operatorFor(column.id)}
                          </span>
                        {/if}
                      </span>
                      <span
                        class="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground"
                      >
                        {#if column.id !== 'date'}
                          {@render valueIconStack(column.id)}
                        {/if}
                        <span class="truncate">{valueSummary(column.id)}</span>
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    class="flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground active:bg-muted"
                    aria-label={`Remove ${column.label} filter`}
                    onclick={(event) => {
                      clearColumn(column.id);
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              {/each}
            </div>
          {:else}
            <div
              class="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground"
            >
              No filters applied.
            </div>
          {/if}
        </div>
      {:else if screen.kind === 'subjects'}
        <div class="flex max-h-[72dvh] flex-col">
          <div class="border-b p-3">
            <label
              class="flex h-10 items-center gap-2 rounded-md border bg-background px-3 text-sm"
            >
              <Search size={16} class="text-muted-foreground" />
              <input
                bind:value={search}
                class="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
                placeholder="Search filters"
              />
            </label>
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto p-2">
            {#each visibleColumns.filter((column) => column.label
                .toLowerCase()
                .includes(search.toLowerCase())) as column (column.id)}
              <button
                type="button"
                class="flex min-h-14 w-full items-center gap-3 rounded-lg px-3 text-left active:bg-muted"
                onclick={() =>
                  go(
                    column.id === 'date'
                      ? { kind: 'date' }
                      : { kind: 'filter', columnId: column.id },
                  )}
              >
                <span
                  class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                >
                  <column.icon size={17} aria-hidden />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-semibold"
                    >{column.label}</span
                  >
                  <span class="block truncate text-xs text-muted-foreground">
                    {isColumnActive(column.id)
                      ? valueSummary(column.id)
                      : 'Not applied'}
                  </span>
                </span>
                {#if isColumnActive(column.id)}
                  <Check size={16} class="text-foreground" />
                {:else}
                  <ChevronRight size={18} class="text-muted-foreground" />
                {/if}
              </button>
            {/each}
          </div>
        </div>
      {:else if screen.kind === 'filter'}
        {@const column = columnById(screen.columnId)}
        {#if column}
          <div class="flex max-h-[72dvh] flex-col">
            <div class="space-y-3 border-b p-3">
              <div class="flex gap-2 overflow-x-auto pb-0.5">
                {#each operatorsFor(screen.columnId) as operator (operator.value)}
                  <button
                    type="button"
                    class={cn(
                      'h-8 shrink-0 rounded-full border px-3 text-xs font-semibold transition-colors',
                      operatorFor(screen.columnId) === operator.value
                        ? 'border-foreground bg-foreground text-background'
                        : 'bg-background text-muted-foreground active:bg-muted',
                    )}
                    onclick={() => setOperator(screen.columnId, operator.value)}
                  >
                    {operator.label}
                  </button>
                {/each}
              </div>
              <label
                class="flex h-10 items-center gap-2 rounded-md border bg-background px-3 text-sm"
              >
                <Search size={16} class="text-muted-foreground" />
                <input
                  bind:value={search}
                  class="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
                  placeholder={`Search ${column.label.toLowerCase()}`}
                />
              </label>
            </div>
            <div class="min-h-0 flex-1 overflow-y-auto p-2">
              {#each filteredOptions(screen.columnId) as option (option.value)}
                {@const selected = valuesFor(screen.columnId).includes(
                  option.value,
                )}
                <button
                  type="button"
                  class="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left active:bg-muted"
                  onclick={() => toggleValue(screen.columnId, option.value)}
                >
                  <span
                    class={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded border',
                      selected &&
                        'border-foreground bg-foreground text-background',
                    )}
                  >
                    {#if selected}
                      <Check size={14} />
                    {/if}
                  </span>
                  {#if hasOptionIcon(option)}
                    <span
                      class="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-sm text-muted-foreground"
                    >
                      {@render optionIcon(option, 22)}
                    </span>
                  {/if}
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium"
                      >{option.label}</span
                    >
                    {#if option.shortLabel}
                      <span class="block text-xs text-muted-foreground">
                        {option.shortLabel}
                      </span>
                    {/if}
                  </span>
                  {#if option.count}
                    <span
                      class="shrink-0 text-xs tabular-nums text-muted-foreground"
                    >
                      {option.count}
                    </span>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        {/if}
      {:else if screen.kind === 'date'}
        <div class="max-h-[72dvh] overflow-y-auto p-4">
          <div class="mb-4 flex gap-2 overflow-x-auto">
            {#each [{ value: 'single', label: 'Exact' }, { value: 'range', label: 'Range' }, { value: 'from', label: 'From' }, { value: 'to', label: 'Until' }] as mode (mode.value)}
              <button
                type="button"
                class={cn(
                  'h-8 shrink-0 rounded-full border px-3 text-xs font-semibold transition-colors',
                  dateMode() === mode.value
                    ? 'border-foreground bg-foreground text-background'
                    : 'bg-background text-muted-foreground active:bg-muted',
                )}
                onclick={() =>
                  setDateMode(mode.value as 'single' | 'range' | 'from' | 'to')}
              >
                {mode.label}
              </button>
            {/each}
          </div>

          <DateRangePicker.Root
            value={dateRangeValue}
            onValueChange={handleDateRangeChange}
            bind:placeholder={calendarPlaceholder}
            weekdayFormat="short"
            fixedWeeks
            closeOnRangeSelect={false}
            class="mx-auto flex w-full max-w-[340px] flex-col gap-2"
          >
            <DateRangePicker.Calendar
              class="rounded-xl border bg-background p-3 shadow-xs"
            >
              {#snippet children({ months, weekdays })}
                <DateRangePicker.Header
                  class="flex items-center justify-between"
                >
                  <CalendarParts.PrevButton>
                    <ChevronLeft class="size-4" />
                  </CalendarParts.PrevButton>
                  <CalendarParts.Heading
                    bind:placeholder={calendarPlaceholder}
                    bind:mode={calendarMode}
                  />
                  <CalendarParts.NextButton>
                    <ChevronRight class="size-4" />
                  </CalendarParts.NextButton>
                </DateRangePicker.Header>
                <div class="pt-3">
                  {#each months as month (month.value)}
                    <DateRangePicker.Grid
                      class="w-full border-collapse select-none space-y-1"
                    >
                      <DateRangePicker.GridHead>
                        <DateRangePicker.GridRow
                          class="mb-1 flex w-full justify-between"
                        >
                          {#each weekdays as day (day)}
                            <DateRangePicker.HeadCell
                              class="w-10 text-center text-xs font-normal text-muted-foreground"
                            >
                              {day.slice(0, 2)}
                            </DateRangePicker.HeadCell>
                          {/each}
                        </DateRangePicker.GridRow>
                      </DateRangePicker.GridHead>
                      <DateRangePicker.GridBody>
                        {#each month.weeks as weekDates (weekDates)}
                          <DateRangePicker.GridRow class="flex w-full">
                            {#each weekDates as date (date)}
                              <DateRangePicker.Cell
                                {date}
                                month={month.value}
                                class="relative m-0 size-10 overflow-visible p-0 text-center text-sm"
                              >
                                <DateRangePicker.Day
                                  class={cn(
                                    'group relative inline-flex size-10 items-center justify-center rounded-md border border-transparent bg-transparent p-0 text-sm font-normal transition-colors',
                                    'hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring',
                                    'data-disabled:pointer-events-none data-disabled:text-foreground/30 data-outside-month:pointer-events-none data-outside-month:text-muted-foreground/40',
                                    'data-highlighted:rounded-none data-highlighted:bg-muted',
                                    'data-selected:bg-muted data-selected:[&:not([data-selection-start])]:[&:not([data-selection-end])]:rounded-none',
                                    'data-selection-start:rounded-md data-selection-start:bg-foreground data-selection-start:text-background data-selection-start:font-semibold',
                                    'data-selection-end:rounded-md data-selection-end:bg-foreground data-selection-end:text-background data-selection-end:font-semibold',
                                  )}
                                >
                                  {date.day}
                                </DateRangePicker.Day>
                              </DateRangePicker.Cell>
                            {/each}
                          </DateRangePicker.GridRow>
                        {/each}
                      </DateRangePicker.GridBody>
                    </DateRangePicker.Grid>
                  {/each}
                </div>
              {/snippet}
            </DateRangePicker.Calendar>
          </DateRangePicker.Root>

          <div class="mt-4 grid grid-cols-2 gap-2">
            <Button variant="outline" class="h-11" onclick={setThisYear}>
              This year
            </Button>
            <Button
              variant="outline"
              class="h-11"
              onclick={() =>
                cloneFilters({
                  years: [],
                  fromDate: undefined,
                  toDate: undefined,
                })}
            >
              Clear date
            </Button>
          </div>
        </div>
      {/if}
    </AnimatedSizeContainer>
  </ModalBody>

  {#if screen.kind === 'home'}
    <ModalFooter class="border-t p-3">
      <Button class="h-11 w-full" onclick={() => (open = false)}>
        Done
        {#if activeColumns.length}
          <span
            class="ml-1 rounded bg-primary-foreground/15 px-1.5 py-0.5 text-xs"
          >
            {activeColumns.length}
          </span>
        {/if}
      </Button>
    </ModalFooter>
  {:else if screen.kind === 'filter'}
    <ModalFooter class="border-t p-3">
      <Button class="h-11 w-full" onclick={() => go({ kind: 'home' })}>
        Done
        {#if optionCount(screen.columnId)}
          <span
            class="ml-1 rounded bg-primary-foreground/15 px-1.5 py-0.5 text-xs"
          >
            {optionCount(screen.columnId)}
          </span>
        {/if}
      </Button>
    </ModalFooter>
  {:else if screen.kind === 'date'}
    <ModalFooter class="border-t p-3">
      <Button class="h-11 w-full" onclick={() => go({ kind: 'home' })}
        >Done</Button
      >
    </ModalFooter>
  {/if}
</Modal>
