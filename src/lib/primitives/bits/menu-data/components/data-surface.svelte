<script lang="ts" generics="TMeta = any">
	import { mergeProps } from "svelte-toolbelt";
	import type { DataSurfaceProps } from "../types.js";
	import {
		DataMenuSurfaceState,
		dataMenuAttrs,
		resolveDeepSearchConfig,
		setDataMenuSurfaceContext,
	} from "../menu-data.svelte.js";
	import { noop } from "$lib/primitives/internal/noop.js";

	let {
		content,
		defaultSearch = "",
		deepSearch = true,
		search = $bindable(defaultSearch),
		onSearchChange = noop,
		loop = true,
		autoHighlightFirst = true,
		clearSearchOnClose = true,
		children,
		ref = $bindable(null),
		onfocusin,
		onpointermove,
		...restProps
	}: DataSurfaceProps<TMeta> = $props();

	function setSearch(value: string) {
		search = value;
		onSearchChange(value);
	}

	const surfaceState = new DataMenuSurfaceState<TMeta>({
		content: () => content,
		deepSearchConfig: () => resolveDeepSearchConfig(deepSearch),
		search: () => search,
		setSearch,
		loop: () => loop,
		autoHighlightFirst: () => autoHighlightFirst,
		clearSearchOnClose: () => clearSearchOnClose,
	});

	setDataMenuSurfaceContext(surfaceState);

	function handleFocusIn(event: FocusEvent) {
		onfocusin?.(event as FocusEvent & { currentTarget: EventTarget & HTMLDivElement });
		if (event.defaultPrevented) return;
		surfaceState.activate();
	}

	function handlePointerMove(event: PointerEvent) {
		onpointermove?.(event as PointerEvent & { currentTarget: EventTarget & HTMLDivElement });
		if (event.defaultPrevented) return;
		surfaceState.activate();
	}

	const mergedProps = $derived(
		mergeProps(restProps, {
			onfocusin: handleFocusIn,
			onpointermove: handlePointerMove,
			[dataMenuAttrs.surface]: "",
		})
	);
</script>

<div bind:this={ref} {...mergedProps}>
	{@render children?.()}
</div>
