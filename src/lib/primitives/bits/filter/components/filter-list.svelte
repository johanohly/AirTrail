<script lang="ts">
	import { mergeProps } from "svelte-toolbelt";
	import type { FilterListProps } from "../types.js";
	import { filterAttrs, useFilterContext } from "../filter.svelte.js";
	import { getColumn } from "../helpers.js";

	let {
		children,
		child,
		ref = $bindable(null),
		...restProps
	}: FilterListProps = $props();

	const context = useFilterContext();
	const mergedProps = $derived(mergeProps(restProps, { [filterAttrs.list]: "" }));
</script>

{#if child}
	{@render child({ props: mergedProps })}
{:else}
	<div bind:this={ref} {...mergedProps}>
		{#each context.filters as filter (filter.columnId)}
			{@const column = getColumn(context.columns, filter.columnId)}
			{@render children?.({ filter, column })}
		{/each}
	</div>
{/if}
