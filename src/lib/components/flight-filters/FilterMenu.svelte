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
  import { FILTER_GROUPS, optionMatchesQuery } from './options';

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
  let optionSearch = $state('');

  /*
   * bits-ui's pointer-transit lock leaks when the pointer hops between sub
   * triggers faster than the submenu choreography settles — every later hover
   * is then gated out and the menu freezes (stuck highlights, a submenu that
   * never closes). We therefore own the submenu state ourselves: exactly one
   * controlled submenu, our own hover-intent timers, and a watchdog that
   * closes it once the pointer leaves the menu tree (root content or any
   * portaled sub content).
   */
  let openSub: string | null = $state(null);
  let intentTimer: ReturnType<typeof setTimeout> | null = null;
  let exitTimer: ReturnType<typeof setTimeout> | null = null;

  const SUB_INTENT_MS = 100;
  const MENU_EXIT_MS = 400;

  const today = todayCalendarDate();

  function clearIntentTimer() {
    if (intentTimer === null) return;
    clearTimeout(intentTimer);
    intentTimer = null;
  }

  function clearExitTimer() {
    if (exitTimer === null) return;
    clearTimeout(exitTimer);
    exitTimer = null;
  }

  function closeSubmenus() {
    clearIntentTimer();
    openSub = null;
  }

  function openSubmenu(key: string) {
    clearIntentTimer();
    clearExitTimer();
    openSub = key;
  }

  function scheduleSubmenu(key: string) {
    clearExitTimer();
    if (openSub === key) return;
    clearIntentTimer();
    intentTimer = setTimeout(() => {
      intentTimer = null;
      openSub = key;
    }, SUB_INTENT_MS);
  }

  function handleSubOpenChange(key: string, next: boolean) {
    if (next) {
      openSubmenu(key);
    } else if (openSub === key) {
      clearIntentTimer();
      openSub = null;
    }
  }

  function scheduleExit() {
    clearExitTimer();
    exitTimer = setTimeout(() => {
      exitTimer = null;
      closeSubmenus();
    }, MENU_EXIT_MS);
  }

  /* The search is per-open: every menu open starts unfiltered. */
  $effect(() => {
    if (!open) {
      search = '';
      optionSearch = '';
      clearExitTimer();
      closeSubmenus();
    }
  });

  function handleSearchKeydown(event: KeyboardEvent) {
    // Keep the menu's typeahead and item activation away from the input
    event.stopPropagation();
  }

  type RegOption = {
    value: string;
    label: string;
    description?: string;
    count?: number;
    icon?: FilterIcon;
  };

  // Columns whose options carry a secondary description render through the
  // custom checkbox list instead of the stock editor (no secondary slot)
  function hasDescribedOptions(column: Column<TData>) {
    return column.id === 'aircraftRegs' || column.id === 'flightNumber';
  }

  function regOptionsFor(column: Column<TData>): RegOption[] {
    const query = optionSearch.trim().toLowerCase();
    const options = column.getOptions() as RegOption[];
    if (!query) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(query) ||
        option.value.toLowerCase().includes(query) ||
        option.description?.toLowerCase().includes(query),
    );
  }

  function isOptionValueSelected(column: Column<TData>, value: string) {
    const values =
      column.type === 'multiOption'
        ? findFilter(column, 'multiOption')?.values
        : findFilter(column, 'option')?.values;
    return values?.map(String).includes(value) ?? false;
  }

  function toggleOptionValue(column: Column<TData>, value: string) {
    const typed = column as Column<TData, 'option' | 'multiOption'>;
    if (isOptionValueSelected(column, value)) {
      actions.removeFilterValue(typed, [value]);
    } else {
      actions.addFilterValue(typed, [value]);
    }
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

  type ColumnOptionLike = {
    value: string;
    label: string;
    shortLabel?: string;
    keywords?: string[];
  };

  const MAX_INLINE_OPTION_MATCHES = 8;

  function columnOptionsOf(column: Column<TData>): ColumnOptionLike[] {
    if (column.type !== 'option' && column.type !== 'multiOption') return [];
    return column.getOptions() as ColumnOptionLike[];
  }

  // A column matches when its name does, or when any of its options does —
  // so queries like "mad" surface the airport columns holding Madrid/MAD
  function columnMatchesSearch(column: Column<TData>) {
    if (matchesSearch(column.displayName)) return true;
    return columnOptionsOf(column).some((option) =>
      optionMatchesQuery(option, searchQuery),
    );
  }

  // Matching options shown inline under a column the name alone wouldn't
  // surface; the submenu entry below them still opens the full list
  function inlineOptionMatchesFor(column: Column<TData>) {
    if (matchesSearch(column.displayName)) return [];
    return columnOptionsOf(column)
      .filter((option) => optionMatchesQuery(option, searchQuery))
      .slice(0, MAX_INLINE_OPTION_MATCHES);
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
          return column && !column.hidden && columnMatchesSearch(column)
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
    <DropdownMenu.Content
      align="start"
      sideOffset={8}
      data-filter-menu-content
      onpointerenter={clearExitTimer}
      onpointerleave={scheduleExit}
    >
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
            <DropdownMenu.Sub
              open={openSub === 'quickDate'}
              onOpenChange={(next) => handleSubOpenChange('quickDate', next)}
            >
              <DropdownMenu.SubTrigger
                openDelay={100}
                onpointerenter={() => scheduleSubmenu('quickDate')}
                onpointerleave={clearIntentTimer}
              >
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
                  onpointerenter={() => {
                    clearIntentTimer();
                    clearExitTimer();
                  }}
                  onpointerleave={scheduleExit}
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
            {@const inlineMatches = inlineOptionMatchesFor(column)}
            {#each inlineMatches as option (option.value)}
              <DropdownMenu.CheckboxItem
                checked={isOptionValueSelected(column, option.value)}
                onCheckedChange={() => toggleOptionValue(column, option.value)}
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
                  <span>{option.label}</span>
                {/snippet}
              </DropdownMenu.CheckboxItem>
            {/each}
          {/each}
        </DropdownMenu.Group>
      {/each}
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>

{#snippet menuColumn(column: Column<TData, ColumnDataType>)}
  <DropdownMenu.Sub
    open={openSub === column.id}
    onOpenChange={(next) => handleSubOpenChange(column.id, next)}
  >
    <DropdownMenu.SubTrigger
      openDelay={100}
      onpointerenter={() => scheduleSubmenu(column.id)}
      onpointerleave={clearIntentTimer}
    >
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
        onpointerenter={() => {
          clearIntentTimer();
          clearExitTimer();
        }}
        onpointerleave={scheduleExit}
      >
        {#if column.id === 'date'}
          <Filter.DateEditor
            filter={findFilter(column, 'date')}
            column={column as Column<TData, 'date'>}
            {actions}
          />
        {:else if hasDescribedOptions(column)}
          {@const options = regOptionsFor(column)}
          <div class="flex flex-col" data-filter-option-list>
            <div class="border-b p-2">
              <label
                class="flex h-8 items-center gap-2 rounded-md border bg-background px-2.5"
              >
                <Search
                  size={14}
                  aria-hidden="true"
                  class="shrink-0 text-muted-foreground"
                />
                <input
                  bind:value={optionSearch}
                  type="text"
                  placeholder={`Search ${column.displayName.toLowerCase()}...`}
                  aria-label={`Search ${column.displayName.toLowerCase()}`}
                  class="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                  onkeydown={handleSearchKeydown}
                />
              </label>
            </div>
            <div class="max-h-[300px] overflow-y-auto p-1">
              {#each options as option (option.value)}
                {@const checked = isOptionValueSelected(column, option.value)}
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={checked}
                  class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent"
                  onclick={() => toggleOptionValue(column, option.value)}
                >
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
                  {#if option.icon}
                    {@render menuIcon(option.icon)}
                  {/if}
                  <span class="min-w-0 flex-1 truncate">{option.label}</span>
                  {#if option.description}
                    <span class="shrink-0 text-muted-foreground">
                      {option.description}
                    </span>
                  {/if}
                  {#if option.count}
                    <span class="shrink-0 tabular-nums text-muted-foreground">
                      {new Intl.NumberFormat().format(option.count)}
                    </span>
                  {/if}
                </button>
              {/each}
              {#if options.length === 0}
                <div
                  class="px-2 py-4 text-center text-xs text-muted-foreground"
                  data-filter-menu-empty
                >
                  No matching {column.displayName.toLowerCase()}.
                </div>
              {/if}
            </div>
          </div>
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
