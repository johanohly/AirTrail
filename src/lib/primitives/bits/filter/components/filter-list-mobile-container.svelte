<script lang="ts">
	import { mergeProps } from "svelte-toolbelt";
	import type { FilterListMobileContainerProps } from "../types.js";
	import { filterAttrs } from "../filter.svelte.js";

	let {
		children,
		child,
		ref = $bindable(null),
		...restProps
	}: FilterListMobileContainerProps = $props();

	const mergedProps = $derived(
		mergeProps(restProps, { [filterAttrs["list-mobile-container"]]: "" })
	);
</script>

{#if child}
	{@render child({ props: mergedProps })}
{:else}
	<div bind:this={ref} {...mergedProps}>
		{@render children?.()}
	</div>
{/if}
