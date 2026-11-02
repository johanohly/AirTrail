<script lang="ts">
  import {
    Armchair,
    ArrowLeftRight,
    Briefcase,
    Calendar as CalendarIcon,
    CalendarCheck,
    CalendarDays,
    Check,
    ChevronRight,
    Earth,
    Flag,
    Globe,
    Hash,
    LocateFixed,
    PersonStanding,
    Plane,
    PlaneLanding,
    PlaneTakeoff,
    Ruler,
    Search,
    Ticket,
    UsersRound,
    X,
    Plus,
  } from '@o7/icon';
  import { Airlines } from '@o7/icon/material';
  import type { Component } from 'svelte';

  import MobileDateFilterScreen from './MobileDateFilterScreen.svelte';

  import { page } from '$app/state';
  import UserAvatar from '$lib/components/display/UserAvatar.svelte';
  import {
    activeFilterCount,
    clearFilterColumn,
    cloneFlightFilters,
    createDefaultFilters,
    dateFilterSummary,
    isFilterColumnActive,
    matchesLocationFilters,
    optionColumnOperator,
    optionColumnValues,
    pluralMultiOptionOperators,
    pluralOptionOperators,
    setOptionColumnOperator,
    setOptionColumnValues,
    singularMultiOptionOperators,
    singularOptionOperators,
    type FilterColumnId,
    type NonPassengerOptionColumnId,
    type OptionColumnId,
  } from '$lib/components/flight-filters/model';
  import {
    compareSeatNumbers,
    continentOptions,
    countryName,
    dayOptions,
    durationOptions,
    flightReasonOptions,
    flightTypeOptions,
    monthOptions,
    seatClassOptions,
    seatTypeOptions,
    type FilterOptionSource,
    FILTER_GROUPS,
  } from '$lib/components/flight-filters/options';
  import {
    hasTempFilters as hasActiveTempFilters,
    normalizeRoute,
    routeKey,
    type FilterLogic,
    type FlightFilters,
    type MultiOptionFilterOperator,
    type OptionFilterOperator,
    type TempFilters,
  } from '$lib/components/flight-filters/types';
  import AnimatedSizeContainer from '$lib/components/ui/animated-size-container.svelte';
  import { Button } from '$lib/components/ui/button';
  import {
    Modal,
    ModalBody,
    ModalFooter,
    ModalHeader,
  } from '$lib/components/ui/modal';
  import { routeLabelForFlight } from '$lib/stats/aggregations';
  import {
    cn,
    getFlightPassengerLabel,
    getFlightPassengerToken,
    type FlightData,
  } from '$lib/utils';
  import { getPreferences } from '$lib/utils/preferences';

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
    keywords?: string[];
    kind?: 'airport' | 'airline' | 'passenger';
    country?: string | null;
    iconPath?: string | null;
    username?: string;
  };

  let {
    open = $bindable(),
    flights,
    filters = $bindable(),
    tempFilters = $bindable(),
    hasTempFilters = false,
  }: {
    open: boolean;
    flights: FlightData[];
    filters: FlightFilters;
    tempFilters?: TempFilters;
    hasTempFilters?: boolean;
  } = $props();

  const prefs = $derived(getPreferences(page.data.user));

  let screen = $state<Screen>({ kind: 'home' });
  let search = $state('');
  let wasOpen = $state(open);

  const tempLocationFiltersActive = $derived(
    hasTempFilters || hasActiveTempFilters(tempFilters),
  );

  const scopedFlights = $derived.by(() => {
    if (!tempLocationFiltersActive || !tempFilters) return flights ?? [];
    return (flights ?? []).filter((flight) =>
      matchesLocationFilters(flight, tempFilters),
    );
  });

  const columns = $derived<FilterColumn[]>([
    {
      id: 'departureAirports',
      label: 'Departure airport',
      icon: PlaneTakeoff,
      type: 'option',
      hidden: tempLocationFiltersActive,
    },
    {
      id: 'arrivalAirports',
      label: 'Arrival airport',
      icon: PlaneLanding,
      type: 'option',
      hidden: tempLocationFiltersActive,
    },
    {
      id: 'routes',
      label: 'Route',
      icon: ArrowLeftRight,
      type: 'option',
    },
    {
      id: 'departureCountries',
      label: 'Departure country',
      icon: Flag,
      type: 'option',
    },
    {
      id: 'arrivalCountries',
      label: 'Arrival country',
      icon: Flag,
      type: 'option',
    },
    {
      id: 'departureContinents',
      label: 'Departure continent',
      icon: Earth,
      type: 'option',
    },
    {
      id: 'arrivalContinents',
      label: 'Arrival continent',
      icon: Earth,
      type: 'option',
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
    {
      id: 'months',
      label: 'Month',
      icon: CalendarDays,
      type: 'option',
    },
    {
      id: 'days',
      label: 'Day of Month',
      icon: CalendarCheck,
      type: 'option',
    },
    {
      id: 'flightType',
      label: 'Flight Type',
      icon: Globe,
      type: 'option',
    },
    {
      id: 'flightNumber',
      label: 'Flight Number',
      icon: Ticket,
      type: 'option',
    },
    { id: 'duration', label: 'Duration', icon: Ruler, type: 'option' },
    { id: 'seatClass', label: 'Class', icon: Armchair, type: 'option' },
    { id: 'flightReason', label: 'Reason', icon: Briefcase, type: 'option' },
    {
      id: 'seatType',
      label: 'Seat Type',
      icon: PersonStanding,
      type: 'option',
    },
    {
      id: 'seatNumber',
      label: 'Seat Number',
      icon: LocateFixed,
      type: 'option',
    },
  ]);

  const visibleColumns = $derived(columns.filter((column) => !column.hidden));

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
    for (const flight of scopedFlights) {
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
          keywords: [airport.iata, airport.icao].filter(
            (code): code is string => !!code,
          ),
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

  // Countries are keyed by their alpha-2 code and named via the ISO table
  function countedCountryOptions(
    countries: Array<string | null | undefined>,
  ): FilterOption[] {
    return countedOptions(
      countries.map((country) =>
        country
          ? {
              value: country,
              label: countryName(country),
              keywords: [country, countryName(country)],
              kind: 'airport' as const,
              country,
            }
          : null,
      ),
    );
  }

  // A flight number can be shared by several airlines (codeshares); the
  // logo shown is the most frequent one among the scoped flights
  function countedFlightNumberOptions(
    sourceFlights: FlightData[],
  ): FilterOption[] {
    const counts = new Map<string, number>();
    const airlineUses = new Map<
      string,
      Map<
        string,
        {
          iconPath: string | null;
          count: number;
        }
      >
    >();

    for (const flight of sourceFlights) {
      if (!flight.flightNumber) continue;
      counts.set(
        flight.flightNumber,
        (counts.get(flight.flightNumber) ?? 0) + 1,
      );
      const iconPath = flight.airline?.iconPath ?? null;
      if (!iconPath) continue;
      const perNumber =
        airlineUses.get(flight.flightNumber) ??
        new Map<string, { iconPath: string | null; count: number }>();
      const entry = perNumber.get(iconPath);
      if (entry) {
        entry.count += 1;
      } else {
        perNumber.set(iconPath, { iconPath, count: 1 });
      }
      airlineUses.set(flight.flightNumber, perNumber);
    }

    return Array.from(counts.entries())
      .map(([flightNumber, count]) => {
        const topIconPath = Array.from(
          airlineUses.get(flightNumber)?.values() ?? [],
        ).sort((a, b) => b.count - a.count)[0]?.iconPath;
        return {
          value: flightNumber,
          label: flightNumber,
          count,
          kind: 'airline' as const,
          iconPath: topIconPath ?? null,
        };
      })
      .sort(
        (a, b) =>
          (b.count ?? 0) - (a.count ?? 0) || a.label.localeCompare(b.label),
      );
  }

  /* Static option lists keep their curated order and carry no counts. */
  function staticOptions(options: FilterOptionSource[]): FilterOption[] {
    return options;
  }

  const optionsByColumn = $derived.by(() => {
    const passengers = new Map<string, FilterOption>();

    for (const flight of scopedFlights) {
      for (const passenger of flight.passengers) {
        const value = getFlightPassengerToken(passenger);
        const label = getFlightPassengerLabel(passenger);
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
            username:
              passenger.user?.username ??
              `guest:${passenger.guestName ?? label}`,
          });
        }
      }
    }

    return {
      departureAirports: uniqueAirportOptions((flight) => flight.from),
      arrivalAirports: uniqueAirportOptions((flight) => flight.to),
      passengers: sortOptions(Array.from(passengers.values())),
      airline: countedOptions(
        scopedFlights.map((flight) =>
          flight.airline
            ? {
                value: flight.airline.name,
                label: flight.airline.name,
                keywords: [flight.airline.iata, flight.airline.icao].filter(
                  (code): code is string => !!code,
                ),
                kind: 'airline',
                iconPath: flight.airline.iconPath,
              }
            : null,
        ),
      ),
      aircraft: countedOptions(
        scopedFlights.map((flight) =>
          flight.aircraft
            ? {
                value: flight.aircraft.name,
                label: flight.aircraft.name,
                keywords: [flight.aircraft.icao].filter(
                  (code): code is string => !!code,
                ),
              }
            : null,
        ),
      ),
      aircraftRegs: countedOptions(
        scopedFlights.map((flight) =>
          flight.aircraftReg
            ? { value: flight.aircraftReg, label: flight.aircraftReg }
            : null,
        ),
      ),
      routes: countedOptions(
        scopedFlights.map((flight) => {
          if (!flight.from || !flight.to) return null;
          const label = routeLabelForFlight(flight);
          if (!label) return null;
          return {
            value: routeKey(
              normalizeRoute(
                flight.from.id.toString(),
                flight.to.id.toString(),
              ),
            ),
            label,
          };
        }),
      ),
      departureCountries: countedCountryOptions(
        scopedFlights.map((flight) => flight.from?.country),
      ),
      arrivalCountries: countedCountryOptions(
        scopedFlights.map((flight) => flight.to?.country),
      ),
      departureContinents: staticOptions(continentOptions),
      arrivalContinents: staticOptions(continentOptions),
      months: staticOptions(monthOptions),
      days: staticOptions(dayOptions),
      flightType: staticOptions(flightTypeOptions),
      flightNumber: countedFlightNumberOptions(scopedFlights),
      duration: staticOptions(durationOptions),
      seatClass: staticOptions(seatClassOptions),
      flightReason: staticOptions(flightReasonOptions),
      seatType: staticOptions(seatTypeOptions),
      seatNumber: countedOptions(
        scopedFlights.flatMap((flight) =>
          flight.passengers.map((passenger) =>
            passenger.seatNumber
              ? { value: passenger.seatNumber, label: passenger.seatNumber }
              : null,
          ),
        ),
      ).sort((a, b) => compareSeatNumbers(a.label, b.label)),
    } satisfies Record<OptionColumnId, FilterOption[]>;
  });

  function valuesFor(columnId: OptionColumnId) {
    return optionColumnValues(filters, columnId);
  }

  function operatorFor(columnId: OptionColumnId) {
    if (columnId === 'passengers') {
      return optionColumnOperator(filters, columnId);
    }
    return optionColumnOperator(filters, columnId);
  }

  function setOperator(
    columnId: OptionColumnId,
    operator: OptionFilterOperator | MultiOptionFilterOperator,
  ) {
    if (columnId === 'passengers') {
      filters = setOptionColumnOperator(
        filters,
        columnId,
        operator as MultiOptionFilterOperator,
      );
      return;
    }

    filters = setOptionColumnOperator(
      filters,
      columnId as NonPassengerOptionColumnId,
      operator as OptionFilterOperator,
    );
  }

  function setValues(columnId: OptionColumnId, values: string[]) {
    filters = setOptionColumnValues(filters, columnId, values);
  }

  function toggleValue(columnId: OptionColumnId, value: string) {
    const currentValues = valuesFor(columnId);
    const nextValues = currentValues.includes(value)
      ? currentValues.filter((item) => item !== value)
      : [...currentValues, value];
    setValues(columnId, nextValues);
  }

  function clearColumn(columnId: FilterColumnId) {
    filters = clearFilterColumn(filters, columnId);
  }

  function isColumnActive(columnId: FilterColumnId) {
    return isFilterColumnActive(filters, columnId);
  }

  const activeColumns = $derived(
    visibleColumns.filter((column) => isColumnActive(column.id)),
  );

  const activeGroups = $derived.by(() => {
    return FILTER_GROUPS.map((group) => ({
      label: group.label,
      columns: group.columns
        .map((id) =>
          visibleColumns.find(
            (candidate) => candidate.id === id && isColumnActive(candidate.id),
          ),
        )
        .filter((column): column is FilterColumn => !!column),
    })).filter((group) => group.columns.length > 0);
  });

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

  function dateSummary() {
    return dateFilterSummary(filters, prefs);
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

  function filteredOptions(columnId: OptionColumnId) {
    const query = search.trim().toLowerCase();
    if (!query) return optionsByColumn[columnId];
    return optionsByColumn[columnId].filter(
      (option) =>
        option.label.toLowerCase().includes(query) ||
        option.value.toLowerCase().includes(query) ||
        option.shortLabel?.toLowerCase().includes(query) ||
        option.keywords?.some((keyword) =>
          keyword.toLowerCase().includes(query),
        ),
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
    filters = createDefaultFilters();
  }

  function setLogic(logic: FilterLogic) {
    filters = cloneFlightFilters(filters, { logic });
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
          <label
            class="flex h-10 shrink-0 items-center gap-2 rounded-md border bg-background px-3 text-sm"
          >
            <Search size={16} class="text-muted-foreground" />
            <input
              type="text"
              value={filters.noteQuery}
              placeholder="Search notes"
              aria-label="Search notes"
              class="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
              oninput={(event) => {
                filters = cloneFlightFilters(filters, {
                  noteQuery: event.currentTarget.value,
                });
              }}
            />
            {#if filters.noteQuery}
              <button
                type="button"
                aria-label="Clear note search"
                class="flex size-5 items-center justify-center rounded-sm text-muted-foreground"
                onclick={() => {
                  filters = cloneFlightFilters(filters, { noteQuery: '' });
                }}
              >
                <X size={14} />
              </button>
            {/if}
          </label>
          {#if activeFilterCount(filters) >= 2}
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-muted-foreground">
                Match
              </span>
              <div
                class="flex rounded-lg border bg-muted/25 p-0.5 text-xs font-semibold"
                role="group"
                aria-label="Filter combination"
              >
                <button
                  type="button"
                  class={cn(
                    'rounded-md px-2.5 py-1.5 transition-colors',
                    filters.logic === 'and'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground',
                  )}
                  aria-pressed={filters.logic === 'and'}
                  onclick={() => setLogic('and')}
                >
                  All
                </button>
                <button
                  type="button"
                  class={cn(
                    'rounded-md px-2.5 py-1.5 transition-colors',
                    filters.logic === 'or'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground',
                  )}
                  aria-pressed={filters.logic === 'or'}
                  onclick={() => setLogic('or')}
                >
                  Any
                </button>
              </div>
            </div>
          {/if}
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
            <div class="space-y-3">
              {#each activeGroups as group (group.label)}
                <div class="space-y-2">
                  <div class="px-1 text-xs font-medium text-muted-foreground">
                    {group.label}
                  </div>
                  {#each group.columns as column (column.id)}
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
                            <span class="truncate"
                              >{valueSummary(column.id)}</span
                            >
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
        {@const columnId = screen.columnId}
        {@const column = columnById(columnId)}
        {#if column}
          <div class="flex max-h-[72dvh] flex-col">
            <div class="space-y-3 border-b p-3">
              <div class="flex gap-2 overflow-x-auto pb-0.5">
                {#each operatorsFor(columnId) as operator (operator.value)}
                  <button
                    type="button"
                    class={cn(
                      'h-8 shrink-0 rounded-full border px-3 text-xs font-semibold transition-colors',
                      operatorFor(columnId) === operator.value
                        ? 'border-foreground bg-foreground text-background'
                        : 'bg-background text-muted-foreground active:bg-muted',
                    )}
                    onclick={() => setOperator(columnId, operator.value)}
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
              {#each filteredOptions(columnId) as option (option.value)}
                {@const selected = valuesFor(columnId).includes(option.value)}
                <button
                  type="button"
                  class="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left active:bg-muted"
                  onclick={() => toggleValue(columnId, option.value)}
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
        <MobileDateFilterScreen bind:filters />
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
    {@const columnId = screen.columnId}
    <ModalFooter class="border-t p-3">
      <Button class="h-11 w-full" onclick={() => go({ kind: 'home' })}>
        Done
        {#if optionCount(columnId)}
          <span
            class="ml-1 rounded bg-primary-foreground/15 px-1.5 py-0.5 text-xs"
          >
            {optionCount(columnId)}
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
