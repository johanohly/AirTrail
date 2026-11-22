<script lang="ts" generics="TMeta = any">
	import { afterTick, mergeProps } from "svelte-toolbelt";
	import type { DataListProps, DataListChildrenSnippetProps } from "../types.js";
	import { dataMenuAttrs, useDataMenuSurfaceContext } from "../menu-data.svelte.js";
	import { createId } from "$lib/primitives/internal/create-id.js";
	import { kbd } from "$lib/primitives/internal/kbd.js";

	const uid = $props.id();

	let {
		id = createId(uid),
		children,
		ref = $bindable(null),
		onkeydown,
		onfocus,
		onpointermove,
		...restProps
	}: DataListProps<TMeta> = $props();

	const surface = useDataMenuSurfaceContext<TMeta>();
	let scrollable = $state(false);
	let atStart = $state(true);
	let atEnd = $state(true);
	let rowWidthFrame: number | null = null;
	let appliedRowWidth: string | null = null;
	const listState = $derived<DataListChildrenSnippetProps<TMeta>>({
		search: surface.search,
		nodes: surface.displayNodes,
		count: surface.displayNodes.length,
		isDeepSearching: surface.isDeepSearching,
	});

	$effect(() => {
		surface.listNode = ref;
	});

	function updateScrollState() {
		if (!ref) {
			scrollable = false;
			atStart = true;
			atEnd = true;
			return;
		}
		const maxScrollTop = Math.max(0, ref.scrollHeight - ref.clientHeight);
		scrollable = maxScrollTop > 1;
		atStart = ref.scrollTop <= 1;
		atEnd = ref.scrollTop >= maxScrollTop - 1;
	}

	function getRowWidthTarget(node: HTMLElement) {
		return node.closest<HTMLElement>(
			[
				"[data-menu-content]",
				"[data-menu-sub-content]",
				"[data-dropdown-menu-content]",
				"[data-dropdown-menu-sub-content]",
				"[data-context-menu-content]",
				"[data-context-menu-sub-content]",
				"[data-menubar-content]",
				"[data-menubar-sub-content]",
			].join(",")
		);
	}

	function getRowCandidates(node: HTMLElement) {
		const selector = [
			"[data-menu-item]",
			"[data-menu-checkbox-item]",
			"[data-menu-radio-item]",
			"[data-menu-sub-trigger]",
			"[data-dropdown-menu-item]",
			"[data-dropdown-menu-checkbox-item]",
			"[data-dropdown-menu-radio-item]",
			"[data-dropdown-menu-sub-trigger]",
			"[data-context-menu-item]",
			"[data-context-menu-checkbox-item]",
			"[data-context-menu-radio-item]",
			"[data-context-menu-sub-trigger]",
			"[data-menubar-item]",
			"[data-menubar-checkbox-item]",
			"[data-menubar-radio-item]",
			"[data-menubar-sub-trigger]",
		].join(",");
		const rows = Array.from(node.querySelectorAll<HTMLElement>(selector));
		return rows.length
			? rows
			: Array.from(node.children).filter(
					(child): child is HTMLElement => child instanceof HTMLElement
				);
	}

	function updateRowWidth() {
		rowWidthFrame = null;
		if (!ref) return;
		const rows = getRowCandidates(ref);
		if (!rows.length) {
			if (appliedRowWidth !== null) {
				ref.style.removeProperty("--row-width");
				getRowWidthTarget(ref)?.style.removeProperty("--row-width");
				appliedRowWidth = null;
			}
			return;
		}

		let maxWidth = 0;
		const restore: Array<() => void> = [];
		for (const row of rows) {
			const previousWidth = row.style.width;
			row.style.width = "max-content";
			restore.push(() => (row.style.width = previousWidth));
			maxWidth = Math.max(maxWidth, row.scrollWidth, row.offsetWidth);
		}
		for (const restoreRow of restore) restoreRow();

		if (maxWidth <= 0) return;
		const width = `${Math.ceil(Math.min(maxWidth + 1, 500))}px`;
		if (appliedRowWidth === width) return;
		appliedRowWidth = width;
		ref.style.setProperty("--row-width", width);
		getRowWidthTarget(ref)?.style.setProperty("--row-width", width);
	}

	function queueUpdateRowWidth() {
		if (!ref) return;
		const win = ref.ownerDocument.defaultView;
		if (!win) return;
		if (rowWidthFrame !== null) win.cancelAnimationFrame(rowWidthFrame);
		rowWidthFrame = win.requestAnimationFrame(updateRowWidth);
	}

	function clearRowWidthFrame() {
		if (rowWidthFrame === null || !ref) return;
		ref.ownerDocument.defaultView?.cancelAnimationFrame(rowWidthFrame);
		rowWidthFrame = null;
	}

	$effect(() => {
		const node = ref;
		if (!node) return;
		updateScrollState();
		queueUpdateRowWidth();
		const win = node.ownerDocument.defaultView;
		if (!win) return;
		const updateMeasurements = () => {
			updateScrollState();
			queueUpdateRowWidth();
		};
		const resizeObserver = new win.ResizeObserver(updateMeasurements);
		resizeObserver.observe(node);
		for (const child of Array.from(node.children)) {
			resizeObserver.observe(child);
		}
		const mutationObserver = new win.MutationObserver(() => {
			updateMeasurements();
			for (const child of Array.from(node.children)) {
				resizeObserver.observe(child);
			}
		});
		mutationObserver.observe(node, { childList: true, subtree: true });
		node.addEventListener("scroll", updateScrollState, { passive: true });
		return () => {
			node.removeEventListener("scroll", updateScrollState);
			mutationObserver.disconnect();
			resizeObserver.disconnect();
			clearRowWidthFrame();
		};
	});

	$effect(() => {
		surface.displayNodes;
		afterTick(() => {
			updateScrollState();
			queueUpdateRowWidth();
		});
	});

	function stopNavigationEvent(event: KeyboardEvent) {
		event.preventDefault();
		event.stopPropagation();
		event.stopImmediatePropagation();
	}

	function handleFocus(event: FocusEvent) {
		onfocus?.(event as FocusEvent & { currentTarget: EventTarget & HTMLDivElement });
		if (event.defaultPrevented) return;
		surface.activate();
	}

	function handlePointerMove(event: PointerEvent) {
		onpointermove?.(event as PointerEvent & { currentTarget: EventTarget & HTMLDivElement });
		if (event.defaultPrevented) return;
		surface.activate();
	}

	function handleKeydown(event: KeyboardEvent) {
		onkeydown?.(event as KeyboardEvent & { currentTarget: EventTarget & HTMLDivElement });
		if (event.defaultPrevented) return;

		if (event.key === kbd.ARROW_DOWN) {
			stopNavigationEvent(event);
			surface.highlightNext();
			return;
		}

		if (event.key === kbd.ARROW_UP) {
			stopNavigationEvent(event);
			surface.highlightPrevious();
			return;
		}

		if (event.key === kbd.HOME) {
			stopNavigationEvent(event);
			surface.highlightFirst();
			return;
		}

		if (event.key === kbd.END) {
			stopNavigationEvent(event);
			surface.highlightLast();
			return;
		}

		if (event.key === kbd.ARROW_RIGHT) {
			if (surface.openHighlightedSubmenu()) {
				stopNavigationEvent(event);
			}
			return;
		}

		if (event.key === kbd.ARROW_LEFT) {
			if (surface.closeToParent()) {
				stopNavigationEvent(event);
			}
			return;
		}

		const isModifierKey = event.ctrlKey || event.altKey || event.metaKey;
		const canRevealInput = !surface.shouldRenderInput && surface.inputVisibility !== "hidden";
		if (!isModifierKey && event.key.length === 1 && surface.selectShortcut(event.key)) {
			stopNavigationEvent(event);
			return;
		}

		if (event.key === kbd.BACKSPACE && canRevealInput) {
			stopNavigationEvent(event);
			surface.revealInput("");
			return;
		}

		if (!isModifierKey && event.key.length === 1 && canRevealInput) {
			stopNavigationEvent(event);
			surface.revealInput(event.key);
			return;
		}

		if (event.key === kbd.ENTER || event.key === kbd.SPACE) {
			stopNavigationEvent(event);
			surface.selectHighlighted();
		}
	}

	const mergedProps = $derived(
		mergeProps(restProps, {
			id,
			role: "listbox",
			tabindex: surface.shouldRenderInput ? -1 : 0,
			"aria-activedescendant": surface.highlightedId ?? undefined,
			"data-empty": listState.count === 0 && surface.search.trim() === "" ? "" : undefined,
			"data-scrollable": scrollable ? "" : undefined,
			"data-scroll-start": atStart ? "" : undefined,
			"data-scroll-end": atEnd ? "" : undefined,
			onkeydown: handleKeydown,
			onfocus: handleFocus,
			onpointermove: handlePointerMove,
			[dataMenuAttrs.list]: "",
		})
	);
</script>

<div bind:this={ref} {...mergedProps}>
	{@render children?.(listState)}
</div>
