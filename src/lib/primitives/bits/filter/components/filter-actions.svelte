<script lang="ts" generics="TContext = any">
	import { mergeProps } from "svelte-toolbelt";
	import type { FilterActionsProps } from "../types.js";
	import { filterAttrs, useFilterContext } from "../filter.svelte.js";
	import { t } from "../i18n.js";

	let {
		hasFilters: hasFiltersProp,
		actions: actionsProp,
		locale: localeProp,
		children,
		child,
		ref = $bindable(null),
		type = "button",
		...restProps
	}: FilterActionsProps<TContext> = $props();

	const context = useFilterContext<unknown, TContext>();
	const hasFilters = $derived(hasFiltersProp ?? context.filters.length > 0);
	const actions = $derived(actionsProp ?? context.actions);
	const locale = $derived(localeProp ?? context.locale ?? "en");

	const mergedProps = $derived(
		mergeProps(restProps, {
			type,
			"data-state": hasFilters ? "visible" : "hidden",
			onclick: () => actions.removeAllFilters(),
			[filterAttrs.actions]: "",
		})
	);
</script>

{#if child}
	{@render child({ props: mergedProps })}
{:else if hasFilters}
	<button bind:this={ref} {...mergedProps}>
		{#if children}
			{@render children()}
		{:else}
			{t("clear", locale)}
		{/if}
	</button>
{/if}
