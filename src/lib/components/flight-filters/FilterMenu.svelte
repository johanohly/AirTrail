<script lang="ts" generics="TData = unknown, TContext = any">
  import { CalendarDate } from '@internationalized/date';
  import { CalendarClock } from '@o7/icon/lucide';
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
  } from '$lib/components/flight-filters/model';

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

  const today = todayCalendarDate();

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
      {#each columns as column (column.id)}
        {#if column.id === 'date' && dateColumn && !dateColumn.hidden}
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger openDelay={0}>
              <span>
                <span aria-hidden="true" data-filter-menu-icon>
                  <CalendarClock size={16} aria-hidden="true" />
                </span>
                Quick Date
              </span>
              <span aria-hidden="true" data-filter-menu-caret>
                <svg viewBox="0 0 15 15" focusable="false">
                  <path d="M6 11V4l4.5 3.5L6 11Z" fill="currentColor" />
                </svg>
              </span>
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
        {#if !column.hidden}
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger openDelay={0}>
              <span>
                {#if column.icon}
                  {@render menuIcon(column.icon)}
                {/if}
                {column.displayName}
              </span>
              <span aria-hidden="true" data-filter-menu-caret>
                <svg viewBox="0 0 15 15" focusable="false">
                  <path d="M6 11V4l4.5 3.5L6 11Z" fill="currentColor" />
                </svg>
              </span>
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
                    ) as
                      | FilterModel<'option'>
                      | FilterModel<'multiOption'>
                      | undefined}
                    locale="en"
                    {strategy}
                  />
                {/if}
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
        {/if}
      {/each}
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>
