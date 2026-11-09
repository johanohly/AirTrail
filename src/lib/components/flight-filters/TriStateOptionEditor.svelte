<script lang="ts">
  import { DropdownMenu as Menu } from 'bits-ui';
  import type { ColumnOption } from 'bits-ui';
  import TriStateOptionItem from './TriStateOptionItem.svelte';
  import type { OptionColumnId } from './model';
  import type { FlightFilters } from './types';
  let {
    options,
    columnId,
    label,
    filters = $bindable(),
  }: {
    options: ColumnOption[];
    columnId: OptionColumnId;
    label: string;
    filters: FlightFilters;
  } = $props();
  const nodes = $derived(
    options.map((option) => ({
      kind: 'item' as const,
      id: columnId + ':' + option.value,
      label: option.label,
      keywords: [option.value, ...(option.keywords ?? [])],
      meta: option,
    })),
  );
</script>

<Menu.DataSurface content={nodes}>
  <Menu.DataInput placeholder={'Search ' + label.toLowerCase() + '...'} />
  <p class="px-3 py-1 text-xs text-muted-foreground">
    Click to include, again to exclude, once more to clear.
  </p>
  <Menu.DataList>
    {#snippet children({ nodes: rows })}
      {#each rows as row}{#if 'node' in row && row.node.meta}<TriStateOptionItem
            id={row.node.id}
            option={row.node.meta}
            {columnId}
            bind:filters
          />{/if}{/each}
    {/snippet}
  </Menu.DataList>
  <Menu.DataEmpty>No matching options.</Menu.DataEmpty>
</Menu.DataSurface>
