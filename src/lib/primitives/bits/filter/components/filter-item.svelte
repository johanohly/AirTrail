<script lang="ts">
	import { mergeProps } from "svelte-toolbelt";
	import type { FilterItemProps } from "../types.js";
	import { filterAttrs, setFilterItemContext, useFilterContext } from "../filter.svelte.js";

	let {
		filter,
		column,
		children,
		child,
		ref = $bindable(null),
		variant,
		...restProps
	}: FilterItemProps = $props();

	const context = useFilterContext();
	const resolvedVariant = $derived(variant ?? context.variant);

	setFilterItemContext({
		get filter() {
			return filter;
		},
		get column() {
			return column;
		},
		get actions() {
			return context.actions;
		},
		get strategy() {
			return context.strategy;
		},
		get locale() {
			return context.locale;
		},
		get entityName() {
			return context.entityName;
		},
		get variant() {
			return resolvedVariant;
		},
	});

	const mergedProps = $derived(
		mergeProps(restProps, {
			"data-column-id": column.id,
			"data-column-type": column.type,
			"data-variant": resolvedVariant,
			[filterAttrs.item]: "",
		})
	);
</script>

{#if child}
	{@render child({ props: mergedProps })}
{:else}
	<div bind:this={ref} {...mergedProps}>
		{@render children?.()}
	</div>
{/if}
