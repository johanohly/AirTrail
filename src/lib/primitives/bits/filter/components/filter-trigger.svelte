<script lang="ts">
	import { mergeProps } from "svelte-toolbelt";
	import type { FilterTriggerProps } from "../types.js";
	import { filterAttrs } from "../filter.svelte.js";
	import { t } from "../i18n.js";

	let {
		children,
		child,
		ref = $bindable(null),
		type = "button",
		hasVisibleFilters = false,
		locale = "en",
		variant,
		...restProps
	}: FilterTriggerProps = $props();

	const menuState = $derived(restProps["data-state"]);

	const mergedProps = $derived(
		mergeProps(restProps, {
			type,
			"data-state": hasVisibleFilters ? "has-filters" : "empty",
			"data-menu-state": menuState,
			"data-variant": variant,
			[filterAttrs.trigger]: "",
		})
	);
</script>

{#if child}
	{@render child({ props: mergedProps })}
{:else}
	<button bind:this={ref} {...mergedProps}>
		{#if children}
			{@render children()}
		{:else}
			{t("filter", locale)}
		{/if}
	</button>
{/if}
