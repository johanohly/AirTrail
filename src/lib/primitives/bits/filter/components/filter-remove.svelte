<script lang="ts">
	import { mergeProps } from "svelte-toolbelt";
	import type { FilterRemoveProps } from "../types.js";
	import { filterAttrs, useFilterActions, useFilterContext, useFilterItemContext } from "../filter.svelte.js";

	let {
		filter: filterProp,
		actions: actionsProp,
		children,
		child,
		ref = $bindable(null),
		type = "button",
		variant,
		...restProps
	}: FilterRemoveProps = $props();

	const context = useFilterContext();
	const itemContext = useFilterItemContext();
	const filter = $derived(filterProp ?? itemContext?.filter);
	const actions = $derived(actionsProp ?? itemContext?.actions ?? useFilterActions());
	const resolvedVariant = $derived(variant ?? itemContext?.variant ?? context.variant);

	function handleClick() {
		if (!filter || !actions) return;
		actions.removeFilter(filter.columnId);
	}

	const mergedProps = $derived(
		mergeProps(restProps, {
			type,
			"data-variant": resolvedVariant,
			onclick: handleClick,
			[filterAttrs.remove]: "",
		})
	);
</script>

{#if !filter || !actions}
	{@const _error = (() => {
		throw new Error("Filter.Remove requires filter/actions props or must be used within Filter.Item");
	})()}
{:else if child}
	{@render child({ props: mergedProps })}
{:else}
	<button bind:this={ref} {...mergedProps}>
		{#if children}
			{@render children()}
		{:else}
			Remove
		{/if}
	</button>
{/if}
