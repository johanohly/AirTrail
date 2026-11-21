<script lang="ts">
	import { mergeProps } from "svelte-toolbelt";
	import type { FilterSubjectProps } from "../types.js";
	import { filterAttrs, useFilterContext, useFilterItemContext } from "../filter.svelte.js";
	import { isBooleanColumn } from "../type-guards.js";
	import FilterIcon from "./filter-icon.svelte";

	let {
		column: columnProp,
		entityName: entityNameProp,
		children,
		child,
		ref = $bindable(null),
		variant,
		...restProps
	}: FilterSubjectProps = $props();

	const context = useFilterContext();
	const itemContext = useFilterItemContext();
	const column = $derived(columnProp ?? itemContext?.column);
	const entityName = $derived(entityNameProp ?? itemContext?.entityName ?? context.entityName);
	const resolvedVariant = $derived(variant ?? itemContext?.variant ?? context.variant);
	const subject = $derived(column && isBooleanColumn(column) ? entityName : column?.displayName);

	const mergedProps = $derived(
		mergeProps(restProps, {
			"data-column-type": column?.type,
			"data-variant": resolvedVariant,
			[filterAttrs.subject]: "",
		})
	);
</script>

{#if !column}
	{@const _error = (() => {
		throw new Error("Filter.Subject requires a column prop or must be used within Filter.Item");
	})()}
{:else if child}
	{@render child({ props: mergedProps })}
{:else}
	<span bind:this={ref} {...mergedProps}>
		{#if column.icon}
			<FilterIcon icon={column.icon} part="subject" />
		{/if}
		{#if children}
			{@render children()}
		{:else}
			{subject}
		{/if}
	</span>
{/if}
