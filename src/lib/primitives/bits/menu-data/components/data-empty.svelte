<script lang="ts">
	import { mergeProps } from "svelte-toolbelt";
	import type { DataEmptyProps } from "../types.js";
	import { dataMenuAttrs, useDataMenuSurfaceContext } from "../menu-data.svelte.js";

	let {
		children,
		ref = $bindable(null),
		...restProps
	}: DataEmptyProps = $props();

	const surface = useDataMenuSurfaceContext();
	const isEmpty = $derived(surface.displayNodes.length === 0);
	const mergedProps = $derived(
		mergeProps(restProps, {
			[dataMenuAttrs.empty]: "",
		})
	);
</script>

{#if isEmpty}
	<div bind:this={ref} {...mergedProps}>
		{@render children?.()}
	</div>
{/if}
