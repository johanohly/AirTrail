<script lang="ts" generics="TData = unknown, TContext = any">
	import DataSurface from "$lib/primitives/bits/menu-data/components/data-surface.svelte";
	import DataInput from "$lib/primitives/bits/menu-data/components/data-input.svelte";
	import DataList from "$lib/primitives/bits/menu-data/components/data-list.svelte";
	import DataEmpty from "$lib/primitives/bits/menu-data/components/data-empty.svelte";
	import type {
		Column,
		DataTableFilterActions,
		FilterModel,
		FilterStrategy,
		Locale,
	} from "../types.js";
	import {
		createMultiOptionMenu,
		createOptionMenu,
		type FilterCheckboxItemDef,
		type FilterMenuNodeMeta,
		type FilterNodeDef,
	} from "../menu-nodes.js";
	import { isMultiOptionColumn, isOptionColumn } from "../type-guards.js";
	import FilterMenuNode from "./filter-menu-node.svelte";

	let {
		column,
		actions,
		filter,
		locale = "en",
		strategy = "client",
		initialValues = [],
		showSeparator = false,
	}: {
		column: Column<TData, "option"> | Column<TData, "multiOption">;
		actions: DataTableFilterActions<TContext>;
		filter?: FilterModel<"option"> | FilterModel<"multiOption">;
		locale?: Locale;
		strategy?: FilterStrategy;
		initialValues?: Array<string | number | bigint | boolean | Date>;
		showSeparator?: boolean;
	} = $props();

	function withSeparator(nodes: FilterCheckboxItemDef[]): FilterNodeDef[] {
		if (!showSeparator || initialValues.length === 0) return nodes;
		const initial = initialValues.map(String);
		const isInitial = (node: FilterCheckboxItemDef) =>
			node.meta?.kind === "option" && initial.includes(node.meta.option.value);
		const selected = nodes.filter(isInitial);
		const unselected = nodes.filter((node) => !isInitial(node));
		if (selected.length === 0 || unselected.length === 0) return nodes;
		return [...selected, { kind: "separator", id: "selected-separator" }, ...unselected];
	}

	const nodes = $derived.by(() => {
		if (isOptionColumn(column)) {
			return withSeparator(
				createOptionMenu({
					column,
					actions,
					filter: filter as FilterModel<"option"> | undefined,
				})
			);
		}
		if (isMultiOptionColumn(column)) {
			return withSeparator(
				createMultiOptionMenu({
					column,
					actions,
					filter: filter as FilterModel<"multiOption"> | undefined,
				})
			);
		}
		return [];
	});

	void strategy;
</script>

<DataSurface content={nodes} deepSearch={{ match: "word-prefix" }}>
	<DataInput placeholder={`Search ${column.displayName.toLowerCase()}...`} />
	<DataList>
		{#snippet children({ nodes: displayNodes })}
			{#each displayNodes as node, index (`option-${index}-${"kind" in node ? node.kind : node.node.id}`)}
				<FilterMenuNode displayNode={node} {actions} {locale} />
			{/each}
		{/snippet}
	</DataList>
	<DataEmpty>No matching options.</DataEmpty>
</DataSurface>
