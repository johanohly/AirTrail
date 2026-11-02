<script lang="ts" generics="TData = unknown, TContext = any">
  import { CalendarDate } from '@internationalized/date';
  import { CalendarClock } from '@o7/icon';
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

  type MenuSection = {
    label: string | undefined;
    columns: Column<TData, ColumnDataType>[];
  };

  type MenuGroup = {
    label: string;
    hasQuickDate: boolean;
    sections: MenuSection[];
  };

  const menuGroups = $derived.by(() => {
    const dateColumnVisible = !!dateColumn && !dateColumn.hidden;

    const visibleColumn = (id: string) => {
      const column = columns.find((candidate) => candidate.id === id);
      return column && !column.hidden ? column : undefined;
    };

    const section = (label: string | undefined, ids: readonly string[]) => ({
      label,
      columns: ids
        .filter((id) => id !== 'quickDate')
        .map(visibleColumn)
        .filter((column): column is Column<TData, ColumnDataType> => !!column),
    });

    return FILTER_GROUPS.map((group) => ({
      label: group.label,
      hasQuickDate:
        (group.columns ?? []).includes('quickDate') && dateColumnVisible,
      sections: group.subgroups
        ? group.subgroups.map((subgroup) =>
            section(subgroup.label, subgroup.columns),
          )
        : [section(undefined, group.columns ?? [])],
    }))
      .map((group) => ({
        ...group,
        sections: group.sections.filter(
          (menuSection) => menuSection.columns.length > 0,
        ),
      }))
      .filter((group) => group.hasQuickDate || group.sections.length > 0);
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
              <DropdownMenu.SubTrigger openDelay={0}>
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
          {#each group.sections as section, sectionIndex (section.label ?? sectionIndex)}
            {#if section.label}
              <div
                class="px-2 pb-1 pt-1.5 text-[11px] font-medium text-muted-foreground/80"
                data-filter-menu-subgroup-heading
              >
                {section.label}
              </div>
            {/if}
            {#each section.columns as column (column.id)}
              {@render menuColumn(column)}
            {/each}
          {/each}
        </DropdownMenu.Group>
      {/each}
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>

{#snippet menuColumn(column: Column<TData, ColumnDataType>)}
  <DropdownMenu.Sub>
    <DropdownMenu.SubTrigger openDelay={0}>
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
