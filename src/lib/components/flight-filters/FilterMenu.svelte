<script lang="ts" generics="TData = unknown, TContext = any">
  import { CalendarDate } from '@internationalized/date';
  import { CalendarClock } from '@o7/icon';
  import { Search, X } from '@o7/icon/lucide';
  import {
    DropdownMenu,
    Filter,
    type Column,
    type ColumnDataType,
    type DataTableFilterActions,
    type FilterIcon,
    type FilterIconComponent,
    type FilterModel,
    type FilterStrategy,
    type FiltersState,
  } from 'bits-ui';
  import type { Snippet } from 'svelte';

  import {
    activeDatePresetForRange,
    datePresetRange,
    datePresets,
    todayCalendarDate,
    type DatePresetId,
  } from './model';
  import { FILTER_GROUPS } from './options';

  let {
    columns,
    filters = [],
    actions,
    strategy = 'client',
    children,
  }: {
    columns: Column<TData, ColumnDataType>[];
    filters?: FiltersState;
    actions: DataTableFilterActions<TContext>;
    strategy?: FilterStrategy;
    children: Snippet;
  } = $props();

  let open = $state(false);
  let search = $state('');

  const today = todayCalendarDate();

  /* The search is per-open: every menu open starts unfiltered. */
  $effect(() => {
    if (!open) search = '';
  });

  function handleSearchKeydown(event: KeyboardEvent) {
    // Keep the menu's typeahead and item activation away from the input
    event.stopPropagation();
  }

  function dateOf(value: CalendarDate) {
    return new Date(value.year, value.month - 1, value.day);
  }

  function calendarDateOf(value: Date | undefined) {
    if (!value) return undefined;
    return new CalendarDate(
      value.getFullYear(),
      value.getMonth() + 1,
      value.getDate(),
    );
  }

  const dateColumn = $derived(columns.find((column) => column.id === 'date'));
  const dateFilter = $derived(
    filters.find(
      (filter): filter is FilterModel<'date'> =>
        filter.columnId === 'date' && filter.type === 'date',
    ),
  );
  const activePreset = $derived(
    activeDatePresetForRange(
      calendarDateOf(dateFilter?.values[0]),
      calendarDateOf(dateFilter?.values[1]),
      today,
    ),
  );

  type MenuGroup = {
    label: string;
    hasQuickDate: boolean;
    columns: Column<TData, ColumnDataType>[];
  };

  const searchQuery = $derived(search.trim().toLowerCase());

  function matchesSearch(label: string) {
    if (!searchQuery) return true;
    return label.toLowerCase().includes(searchQuery);
  }

  function matchesQuickDateSearch() {
    if (!searchQuery) return true;
    return ['quick date', 'preset', 'date'].some(
      (keyword) =>
        keyword.includes(searchQuery) || searchQuery.includes(keyword),
    );
  }

  const menuGroups = $derived.by(() => {
    const dateColumnVisible = !!dateColumn && !dateColumn.hidden;

    return FILTER_GROUPS.map((group) => ({
      label: group.label,
      hasQuickDate:
        group.columns.includes('quickDate') &&
        dateColumnVisible &&
        matchesQuickDateSearch(),
      columns: group.columns
        .filter((id) => id !== 'quickDate')
        .map((id) => {
          const column = columns.find((candidate) => candidate.id === id);
          return column && !column.hidden && matchesSearch(column.displayName)
            ? column
            : undefined;
        })
        .filter((column): column is Column<TData, ColumnDataType> => !!column),
    })).filter((group) => group.hasQuickDate || group.columns.length > 0);
  });

  /* Mirrors bits-ui's filter-icon.svelte detection between components and snippets. */
  function isComponentIcon(
    icon: FilterIcon | undefined,
  ): icon is FilterIconComponent {
    if (typeof icon !== 'function') return false;
    if (icon.length >= 2) return true;
    return Boolean(icon.prototype && '$destroy' in icon.prototype);
  }

  function findFilter<TType extends FilterModel['type']>(
    column: Column<TData>,
    type: TType,
  ) {
    return filters.find(
      (filter): filter is FilterModel<TType> =>
        filter.columnId === column.id && filter.type === type,
    );
  }

  function toggleDatePreset(id: DatePresetId) {
    if (!dateColumn) return;

    if (activePreset === id) {
      actions.removeFilter(dateColumn.id);
      return;
    }

    const range = datePresetRange(id, today);
    actions.batch((batchActions) => {
      if (dateFilter?.values.length) batchActions.removeFilter(dateColumn.id);
      batchActions.setFilterValue(dateColumn as Column<TData, 'date'>, [
        dateOf(range.fromDate),
        dateOf(range.toDate),
      ]);
      batchActions.setFilterOperator(dateColumn.id, 'is between');
    });
  }
</script>

{#snippet menuIcon(icon: FilterIcon | undefined)}
  {#if icon}
    <span aria-hidden="true" data-filter-menu-icon>
      {#if isComponentIcon(icon)}
        {@const Icon = icon}
        <Icon size={16} aria-hidden="true" />
      {:else}
        {@render icon()}
      {/if}
    </span>
  {/if}
{/snippet}

{#snippet menuCaret()}
  <span aria-hidden="true" data-filter-menu-caret>
    <svg viewBox="0 0 15 15" focusable="false">
      <path d="M6 11V4l4.5 3.5L6 11Z" fill="currentColor" />
    </svg>
  </span>
{/snippet}

<DropdownMenu.Root bind:open>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <button
        type="button"
        {...props}
        data-filter-trigger
        data-state={filters.length ? 'has-filters' : 'empty'}
        data-menu-state={props['data-state']}
      >
        {@render children()}
      </button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Portal>
    <DropdownMenu.Content align="start" sideOffset={8} data-filter-menu-content>
      <div class="border-b p-2" data-filter-menu-search>
        <label
          class="flex h-8 items-center gap-2 rounded-md border bg-background px-2.5"
        >
          <Search
            size={14}
            aria-hidden="true"
            class="shrink-0 text-muted-foreground"
          />
          <input
            bind:value={search}
            type="text"
            placeholder="Search filters..."
            aria-label="Search filters"
            class="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            onkeydown={handleSearchKeydown}
          />
          {#if search}
            <button
              type="button"
              tabindex="-1"
              aria-label="Clear filter search"
              class="flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
              onclick={() => (search = '')}
            >
              <X size={12} aria-hidden="true" />
            </button>
          {/if}
        </label>
      </div>
      {#if searchQuery && menuGroups.length === 0}
        <div
          class="px-2 py-4 text-center text-xs text-muted-foreground"
          data-filter-menu-empty
        >
          No matching filters.
        </div>
      {/if}
      {#each menuGroups as group, groupIndex (group.label)}
        {#if groupIndex > 0}
          <DropdownMenu.Separator class="h-px bg-border" />
        {/if}
        <DropdownMenu.Group>
          <DropdownMenu.GroupHeading
            class="px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground"
            data-filter-menu-group-heading
          >
            {group.label}
          </DropdownMenu.GroupHeading>
          {#if group.hasQuickDate}
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger openDelay={100}>
                <span>
                  <span aria-hidden="true" data-filter-menu-icon>
                    <CalendarClock size={16} aria-hidden="true" />
                  </span>
                  Quick Date
                </span>
                {@render menuCaret()}
              </DropdownMenu.SubTrigger>
              <DropdownMenu.Portal>
                <DropdownMenu.SubContent
                  sideOffset={8}
                  align="list"
                  collisionAvoidance={{ side: 'flip', align: 'shift' }}
                >
                  {#each datePresets as preset (preset.id)}
                    <DropdownMenu.CheckboxItem
                      checked={activePreset === preset.id}
                      onCheckedChange={() => toggleDatePreset(preset.id)}
                    >
                      {#snippet children({ checked })}
                        <span
                          aria-hidden="true"
                          data-state={checked ? 'checked' : 'unchecked'}
                          data-filter-menu-checkbox-indicator
                        >
                          <svg viewBox="0 0 24 24" focusable="false">
                            <path
                              d="m20 6-11 11-5-5"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2.5"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            />
                          </svg>
                        </span>
                        <span>{preset.label}</span>
                      {/snippet}
                    </DropdownMenu.CheckboxItem>
                  {/each}
                </DropdownMenu.SubContent>
              </DropdownMenu.Portal>
            </DropdownMenu.Sub>
          {/if}
          {#each group.columns as column (column.id)}
            {@render menuColumn(column)}
          {/each}
        </DropdownMenu.Group>
      {/each}
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>

{#snippet menuColumn(column: Column<TData, ColumnDataType>)}
  <DropdownMenu.Sub>
    <DropdownMenu.SubTrigger openDelay={100}>
      <span>
        {#if column.icon}
          {@render menuIcon(column.icon)}
        {/if}
        {column.displayName}
      </span>
      {@render menuCaret()}
    </DropdownMenu.SubTrigger>
    <DropdownMenu.Portal>
      <DropdownMenu.SubContent
        sideOffset={8}
        align={column.type === 'option' || column.type === 'multiOption'
          ? 'list'
          : 'start'}
        collisionAvoidance={{ side: 'flip', align: 'shift' }}
      >
        {#if column.id === 'date'}
          <Filter.DateEditor
            filter={findFilter(column, 'date')}
            column={column as Column<TData, 'date'>}
            {actions}
          />
        {:else if column.type === 'option' || column.type === 'multiOption'}
          <Filter.OptionEditor
            column={column as
              Column<TData, 'option'> | Column<TData, 'multiOption'>}
            {actions}
            filter={findFilter(
              column,
              column.type as 'option' | 'multiOption',
            ) as FilterModel<'option'> | FilterModel<'multiOption'> | undefined}
            locale="en"
            {strategy}
          />
        {/if}
      </DropdownMenu.SubContent>
    </DropdownMenu.Portal>
  </DropdownMenu.Sub>
{/snippet}
