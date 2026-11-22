<script lang="ts">
	import { mergeProps } from "svelte-toolbelt";
	import type { FilterRootProps } from "../types.js";
	import { filterAttrs } from "../filter.svelte.js";

	let {
		children,
		child,
		ref = $bindable(null),
		...restProps
	}: FilterRootProps = $props();

	const mergedProps = $derived(mergeProps(restProps, { [filterAttrs.root]: "" }));
</script>

{#if child}
	{@render child({ props: mergedProps })}
{:else}
	<div bind:this={ref} {...mergedProps}>
		{@render children?.()}
	</div>
{/if}
