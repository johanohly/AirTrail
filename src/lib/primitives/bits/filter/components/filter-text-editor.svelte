<script lang="ts" generics="TData = unknown, TContext = any">
	import DataSurface from "$lib/primitives/bits/menu-data/components/data-surface.svelte";
	import DataInput from "$lib/primitives/bits/menu-data/components/data-input.svelte";
	import DataList from "$lib/primitives/bits/menu-data/components/data-list.svelte";
	import { dataMenuAttrs } from "$lib/primitives/bits/menu-data/menu-data.svelte.js";
	import type { Column, DataTableFilterActions } from "../types.js";
	import { createTextFilterItems, type FilterMenuNodeMeta } from "../menu-nodes.js";
	import { filterAttrs } from "../filter.svelte.js";
	import FilterMenuNode from "./filter-menu-node.svelte";

	let {
		column,
		actions,
	}: {
		column: Column<TData, "text">;
		actions: DataTableFilterActions<TContext>;
	} = $props();

	let query = $state("");
	const nodes = $derived(createTextFilterItems({ query, column, actions }));
</script>

<DataSurface content={nodes} search={query}>
	<DataInput placeholder="Type to filter..." onValueChange={(value) => (query = value)} />
	<DataList>
		{#snippet children({ nodes: displayNodes })}
			{#if displayNodes.length > 0}
				{#each displayNodes as node, index (`text-${index}-${"kind" in node ? node.kind : node.node.id}`)}
					<FilterMenuNode displayNode={node} {actions} />
				{/each}
			{:else if query.trim()}
				<div {...{ [dataMenuAttrs.empty]: "", [filterAttrs["menu-empty"]]: "" }}>
					Press enter to filter by "{query}"
				</div>
			{/if}
		{/snippet}
	</DataList>
</DataSurface>
