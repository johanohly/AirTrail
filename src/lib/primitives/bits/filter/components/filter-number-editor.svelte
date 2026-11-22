<script lang="ts" generics="TData = unknown, TContext = any">
	import DataSurface from "$lib/primitives/bits/menu-data/components/data-surface.svelte";
	import DataInput from "$lib/primitives/bits/menu-data/components/data-input.svelte";
	import DataList from "$lib/primitives/bits/menu-data/components/data-list.svelte";
	import { dataMenuAttrs } from "$lib/primitives/bits/menu-data/menu-data.svelte.js";
	import type { Column, DataTableFilterActions, DurationUnit } from "../types.js";
	import { createNumberFilterItems, type FilterMenuNodeMeta } from "../menu-nodes.js";
	import { filterAttrs } from "../filter.svelte.js";
	import FilterMenuNode from "./filter-menu-node.svelte";

	let {
		column,
		actions,
		baseUnit = "ms",
	}: {
		column: Column<TData, "number">;
		actions: DataTableFilterActions<TContext>;
		baseUnit?: DurationUnit;
	} = $props();

	let query = $state("");
	const nodes = $derived(createNumberFilterItems({ query, column, actions, baseUnit }));
	const placeholder = $derived(
		baseUnit && baseUnit !== "ms"
			? "Type number or duration (e.g. 1hr, 30min)..."
			: "Type a number..."
	);
</script>

<DataSurface content={nodes} search={query}>
	<DataInput {placeholder} onValueChange={(value) => (query = value)} />
	<DataList>
		{#snippet children({ nodes: displayNodes })}
			{#if displayNodes.length > 0}
				{#each displayNodes as node, index (`number-${index}-${"kind" in node ? node.kind : node.node.id}`)}
					<FilterMenuNode displayNode={node} {actions} />
				{/each}
			{:else if query.trim()}
				<div {...{ [dataMenuAttrs.empty]: "", [filterAttrs["menu-empty"]]: "" }}>
					Enter a valid number
				</div>
			{/if}
		{/snippet}
	</DataList>
</DataSurface>
