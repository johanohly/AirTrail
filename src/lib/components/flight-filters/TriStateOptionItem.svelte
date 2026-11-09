<script lang="ts">
  import { DropdownMenu as Menu } from 'bits-ui';
  import type { ColumnOption } from 'bits-ui';
  import { Check, X } from '@o7/icon';
  import FilterOptionIcon from './FilterOptionIcon.svelte';
  import {
    cycleOptionValue,
    optionValueState,
    type OptionColumnId,
  } from './model';
  import type { FlightFilters } from './types';
  let {
    option,
    columnId,
    filters = $bindable(),
    id,
    breadcrumb,
  }: {
    option: ColumnOption;
    columnId: OptionColumnId;
    filters: FlightFilters;
    id?: string;
    breadcrumb?: string;
  } = $props();
  const state = $derived(optionValueState(filters, columnId, option.value));
</script>

<Menu.Item
  {id}
  closeOnSelect={false}
  aria-label={option.label +
    ': ' +
    state +
    '. Select to ' +
    (state === 'unselected'
      ? 'include'
      : state === 'include'
        ? 'exclude'
        : 'clear')}
  onSelect={() => (filters = cycleOptionValue(filters, columnId, option.value))}
>
  <span
    data-filter-menu-checkbox-indicator
    data-state={state === 'unselected' ? 'unchecked' : 'checked'}
    data-selection={state}
    aria-hidden="true"
  >
    {#if state === 'include'}<Check size={14} />{:else if state === 'exclude'}<X
        size={14}
      />{/if}
  </span>
  <span
    ><FilterOptionIcon icon={option.icon} />{#if breadcrumb}<span
        class="text-muted-foreground"
        >{breadcrumb} /
      </span>{/if}{option.label}</span
  >
  {#if option.count}<span data-filter-menu-count>{option.count}</span>{/if}
</Menu.Item>
