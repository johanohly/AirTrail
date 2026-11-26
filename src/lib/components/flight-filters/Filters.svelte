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
  import { CalendarClock, Funnel, X } from '@o7/icon';
  import { createRawSnippet } from 'svelte';
  import type { Component } from 'svelte';

  import './filter.css';
  import './filter-date.css';

  import {
    FILTER_DEFINITIONS,
    FILTER_GROUPS,
    type FilterOptionIcon,
    type FilterScope,
  } from './definitions';
  import {
    activeDatePreset,
    bitsFiltersToFlightFilters,
    bitsSignature,
    createDefaultFilters,
    datePresets,
    filterOptions,
    filterScope,
    flightFiltersToBits,
    flightSignature,
    hasFlightFilters,
    todayCalendarDate,
    toggleDatePreset,
  } from './model';
  import {
    hasTempFilters as hasActiveTempFilters,
    type FlightFilters,
    type TempFilters,
  } from './types';

  import { page } from '$app/state';
  import UserAvatar from '$lib/components/display/UserAvatar.svelte';
  import { getModalContext } from '$lib/components/ui/modal/Modal.svelte';
  import {
    createColumns,
    Filter,
    useDataTableFilters,
    type ColumnConfig,
    type FilterIcon,
    type FilterMenuGroup,
    type FiltersState,
  } from '$lib/primitives';
  import { scopeSeatUserId } from '$lib/state.svelte';
  import { cn, type FlightData } from '$lib/utils';

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

  function imageIcon(attribute: string, src: string): FilterIcon {
    return createRawSnippet(() => ({
      render: () =>
        `<img ${attribute} src="${escapeAttribute(src)}" alt="" loading="lazy" decoding="async" />`,
    }));
  }

  function passengerAvatarIcon(
    icon: Extract<FilterOptionIcon, { kind: 'avatar' }>,
  ): FilterIcon {
    const Icon: Component<FilterIconProps> = (internals, props) =>
      UserAvatar(internals, {
        ...props,
        username: icon.username,
        userId: icon.userId,
        avatarHash: icon.avatarHash ?? null,
        size: props.size ?? 16,
        animated: false,
        class: cn('airtrail-filter-user-avatar', props.class),
      });

    return Icon;
  }

  function optionIcon(icon: FilterOptionIcon | undefined) {
    switch (icon?.kind) {
      case 'flag':
        return imageIcon(
          'data-filter-airport-flag-icon',
          `https://flagcdn.com/${icon.country.toLowerCase()}.svg`,
        );
      case 'logo':
        return imageIcon('data-filter-airline-icon', icon.src);
      case 'avatar':
        return passengerAvatarIcon(icon);
    }
  }

  const drilldownActive = $derived(
    hasTempFilters || hasActiveTempFilters(tempFilters),
  );
  const seatUserId = $derived(scopeSeatUserId(page.data.user?.id));
  // The filters only shape the options through the seat scope, so a string
  // key keeps other filter changes from rebuilding every option list.
  const scopeKey = $derived(JSON.stringify(filterScope(filters, seatUserId)));
  const options = $derived(
    filterOptions(flights ?? [], {
      scope: JSON.parse(scopeKey) as FilterScope,
      tempFilters,
    }),
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

  // The options carry their own counts, so the columns use the server
  // strategy and never count the flights themselves.
  const columnsConfig = $derived(
    FILTER_DEFINITIONS.map((definition): ColumnConfig<FlightData> =>
      definition.kind === 'date'
        ? {
            id: definition.id,
            displayName: definition.label,
            type: 'date',
            icon: definition.icon,
            group: definition.group,
            accessor: (flight) => flight.date,
          }
        : {
            id: definition.id,
            displayName: definition.label,
            type: 'multi' in definition ? 'multiOption' : 'option',
            icon: definition.icon,
            group: definition.group,
            pluralName: 'plural' in definition ? definition.plural : undefined,
            hidden: drilldownActive && 'replacedByDrilldown' in definition,
            accessor: () => undefined,
            options: options[definition.id].map((option) => ({
              value: option.value,
              label: option.label,
              description: option.description,
              keywords: option.keywords,
              icon: optionIcon(option.icon),
            })),
            facetedOptions: new Map(
              options[definition.id].map((option) => [
                option.value,
                option.count,
              ]),
            ),
          },
    ),
  );
  const columns = $derived(
    createColumns(flights ?? [], columnsConfig, 'server'),
  );

  const today = todayCalendarDate();
  const menuGroups = $derived<FilterMenuGroup[]>(
    FILTER_GROUPS.map((group) => ({
      ...group,
      nodes:
        group.id === 'date'
          ? [
              {
                kind: 'submenu',
                id: 'quickDate',
                title: 'Quick date',
                meta: { kind: 'custom', icon: CalendarClock, search: false },
                nodes: datePresets.map((preset) => ({
                  kind: 'checkbox-item',
                  id: `quickDate-${preset.id}`,
                  label: preset.label,
                  checked: activeDatePreset(filters, today) === preset.id,
                  closeOnSelect: true,
                  onCheckedChange: () => {
                    filters = toggleDatePreset(filters, preset.id, today);
                  },
                })),
              },
            ]
          : [],
    })),
  );

  const filterState = useDataTableFilters({
    strategy: 'server',
    data: [],
    columnsConfig: [],
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
        const column = columns.find(
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
</script>

<Filter.Provider
  columns={columns as never}
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
  <Filter.Menu groups={menuGroups}>
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
