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
  import type { ColumnConfig, FilterIcon, FiltersState } from 'bits-ui';

  import './filter.css';
  import './filter-date.css';

  import {
    bitsFiltersToFlightFilters,
    bitsSignature,
    createDefaultFilters,
    flightFiltersToBits,
    flightSignature,
    hasFlightFilters,
    matchesLocationFilters,
  } from '$lib/components/flight-filters/model';
  import type {
    FlightFilters,
    TempFilters,
  } from '$lib/components/flight-filters/types';
  import UserAvatar from '$lib/components/display/UserAvatar.svelte';
  import {
    cn,
    getFlightPassengerLabel,
    getFlightPassengerToken,
    type FlightData,
  } from '$lib/utils';
  import type { Aircraft, Airline, Airport } from '$lib/db/types';
  import { getModalContext } from '$lib/components/ui/modal/Modal.svelte';

  type FlightFilterColumnConfig =
    | ColumnConfig<FlightData, 'option', string, 'departureAirports'>
    | ColumnConfig<FlightData, 'option', string, 'arrivalAirports'>
    | ColumnConfig<FlightData, 'option', string, 'year'>
    | ColumnConfig<FlightData, 'date', Date, 'date'>
    | ColumnConfig<FlightData, 'multiOption', string[], 'passengers'>
    | ColumnConfig<FlightData, 'option', string, 'airline'>
    | ColumnConfig<FlightData, 'option', string, 'aircraft'>
    | ColumnConfig<FlightData, 'option', string, 'aircraftRegs'>;

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
    keywords?: string[];
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

  // When viewing a route/airport drilldown, scope the filter options to the
  // flights on that route/airport so only relevant values are offered.
  const scopedFlights = $derived.by(() => {
    if (!tempLocationFiltersActive || !tempFilters) return flights ?? [];
    return (flights ?? []).filter((flight) =>
      matchesLocationFilters(flight, tempFilters),
    );
  });
  const modalCtx = getModalContext();
  const filterContentZIndex = $derived.by(() => {
    const modalZ = modalCtx?.getContentZIndex();
    return modalZ !== undefined ? `${modalZ + 5}` : undefined;
  });

  $effect(() => {
    if (!filterContentZIndex) return;
    return pushFilterContentZIndex(filterContentZIndex);
  });

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
        keywords: [airport.iata, airport.icao].filter(
          (code): code is string => !!code,
        ),
        icon: airportFlagIcon(airport),
      }));
  };

  function columnOptions(options: OptionSource[]) {
    return options;
  }

  const departureAirports = $derived.by(() => {
    return uniqueAirports(scopedFlights, (flight) => flight.from);
  });

  const arrivalAirports = $derived.by(() => {
    return uniqueAirports(scopedFlights, (flight) => flight.to);
  });

  const passengerOptions = $derived.by(() => {
    const options = new Map<string, OptionSource>();

    for (const flight of scopedFlights) {
      for (const passenger of flight.passengers) {
        const value = getFlightPassengerToken(passenger);
        const label = getFlightPassengerLabel(passenger);

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
              passenger.user?.username ??
                `guest:${passenger.guestName ?? label}`,
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

    for (const flight of scopedFlights) {
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
        keywords: [airline.iata, airline.icao].filter(
          (code): code is string => !!code,
        ),
        count,
        icon: airlineIcon(airline),
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  });

  const aircraftOptions = $derived.by(() => {
    const frequencyMap = new Map<
      string,
      {
        aircraft: Aircraft;
        count: number;
      }
    >();

    for (const flight of scopedFlights) {
      if (!flight.aircraft) continue;
      const existing = frequencyMap.get(flight.aircraft.name);
      if (existing) {
        existing.count += 1;
      } else {
        frequencyMap.set(flight.aircraft.name, {
          aircraft: flight.aircraft,
          count: 1,
        });
      }
    }

    return Array.from(frequencyMap.values())
      .map(({ aircraft, count }) => ({
        value: aircraft.name,
        label: aircraft.name,
        keywords: [aircraft.icao].filter((code): code is string => !!code),
        count,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  });

  const aircraftRegOptions = $derived.by(() => {
    const frequencyMap = new Map<string, number>();

    for (const flight of scopedFlights) {
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

    for (const flight of scopedFlights) {
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
          flight.passengers
            .map((passenger) => getFlightPassengerToken(passenger))
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
    ] satisfies ReadonlyArray<FlightFilterColumnConfig>;
  });

  const filterState = useDataTableFilters({
    strategy: 'client',
    data: flights,
    columnsConfig,
    entityName: 'Flight',
    defaultFilters: flightFiltersToBits(filters),
  });

  let lastSyncedBitsSignature = $state(bitsSignature(filterState.filters));
  let lastSyncedFlightSignature = $state(flightSignature(filters));
  const showClear = $derived(hasFlightFilters(filters));

  function syncBitsFilters(nextBits: FiltersState) {
    filterState.actions.batch((actions) => {
      actions.removeAllFilters();

      for (const filter of nextBits) {
        const column = filterState.columns.find(
          (candidate) => candidate.id === filter.columnId,
        );
        if (!column) continue;

        actions.setFilterValue(column, filter.values);
        actions.setFilterOperator(filter.columnId, filter.operator);
      }
    });
  }

  $effect(() => {
    const currentBitsSignature = bitsSignature(filterState.filters);
    if (currentBitsSignature === lastSyncedBitsSignature) return;

    lastSyncedBitsSignature = currentBitsSignature;
    filters = bitsFiltersToFlightFilters(filterState.filters, filters);
    lastSyncedFlightSignature = flightSignature(filters);
  });

  $effect(() => {
    const currentFlightSignature = flightSignature(filters);
    if (currentFlightSignature === lastSyncedFlightSignature) return;

    const nextBits = flightFiltersToBits(filters);
    const nextBitsSignature = bitsSignature(nextBits);

    lastSyncedFlightSignature = currentFlightSignature;
    if (nextBitsSignature === lastSyncedBitsSignature) return;

    lastSyncedBitsSignature = nextBitsSignature;
    syncBitsFilters(nextBits);
  });

  const providerColumns = $derived(filterState.columns);
</script>

<Filter.Provider
  columns={providerColumns as never}
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
  <button
    type="button"
    data-filter-actions
    data-state={showClear ? 'visible' : 'hidden'}
    disabled={!showClear}
    onclick={() => {
      filters = createDefaultFilters();
    }}
  >
    <X size={14} aria-hidden="true" />
    <span>Clear</span>
  </button>
{/snippet}
