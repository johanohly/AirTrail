<script lang="ts" generics="TData = unknown, TContext = any">
	import Root from "$lib/primitives/bits/menu/components/menu.svelte";
	import Trigger from "$lib/primitives/bits/menu/components/menu-trigger.svelte";
	import Portal from "$lib/primitives/bits/utilities/portal/portal.svelte";
	import Content from "$lib/primitives/bits/dropdown-menu/components/dropdown-menu-content.svelte";
	import DataSurface from "$lib/primitives/bits/menu-data/components/data-surface.svelte";
	import DataInput from "$lib/primitives/bits/menu-data/components/data-input.svelte";
	import DataList from "$lib/primitives/bits/menu-data/components/data-list.svelte";
	import DataEmpty from "$lib/primitives/bits/menu-data/components/data-empty.svelte";
	import type { FilterMenuProps } from "../types.js";
	import { filterAttrs, useFilterContext } from "../filter.svelte.js";
	import { createColumnNodes, type FilterMenuNodeMeta } from "../menu-nodes.js";
	import FilterTrigger from "./filter-trigger.svelte";
	import FilterMenuNode from "./filter-menu-node.svelte";

	let {
		columns: columnsProp,
		filters: filtersProp,
		actions: actionsProp,
		strategy: strategyProp,
		locale: localeProp,
		variant: variantProp,
		children,
		open = $bindable(false),
		onOpenChange,
	}: FilterMenuProps<TData, TContext> = $props();

	const context = useFilterContext<TData, TContext>();
	const columns = $derived(columnsProp ?? context.columns);
	const filters = $derived(filtersProp ?? context.filters);
	const actions = $derived(actionsProp ?? context.actions);
	const strategy = $derived(strategyProp ?? context.strategy);
	const locale = $derived(localeProp ?? context.locale ?? "en");
	const variant = $derived(variantProp ?? context.variant);
	const visibleColumns = $derived(columns.filter((column) => !column.hidden));
	const visibleFilters = $derived(
		filters.filter((filter) => visibleColumns.some((column) => column.id === filter.columnId))
	);
	const nodes = $derived<ReturnType<typeof createColumnNodes>>(
		createColumnNodes({ columns, filters, actions, locale, strategy })
	);
</script>

<Root bind:open {onOpenChange}>
	<Trigger>
		{#snippet child({ props })}
			{#if children}
				<FilterTrigger
					{...props}
					hasVisibleFilters={visibleFilters.length > 0}
					{locale}
					{variant}
				>
					{@render children()}
				</FilterTrigger>
			{:else}
				<FilterTrigger
					{...props}
					hasVisibleFilters={visibleFilters.length > 0}
					{locale}
					{variant}
				/>
			{/if}
		{/snippet}
	</Trigger>
	<Portal>
		<Content align="start" sideOffset={8} data-filter-menu-content>
			<DataSurface content={nodes}>
				<DataInput placeholder="Search filters..." data-filter-menu-input />
				<DataList data-filter-menu-list>
					{#snippet children({ nodes: displayNodes })}
						{#each displayNodes as node, index (`filter-menu-${index}-${"kind" in node ? node.kind : node.node.id}`)}
							<FilterMenuNode
								displayNode={node}
								{actions}
								{filters}
								{locale}
								{strategy}
							/>
						{/each}
					{/snippet}
				</DataList>
				<DataEmpty data-filter-menu-empty>No matching filters.</DataEmpty>
			</DataSurface>
		</Content>
	</Portal>
</Root>
