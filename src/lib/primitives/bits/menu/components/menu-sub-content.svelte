<script lang="ts">
	import { afterTick, boxWith, mergeProps } from "svelte-toolbelt";
	import type { MenuSubContentProps } from "../types.js";
	import { MenuOpenEvent, MenuContentState } from "../menu.svelte.js";
	import { SUB_CLOSE_KEYS } from "../utils.js";
	import { createId } from "$lib/primitives/internal/create-id.js";
	import PopperLayer from "$lib/primitives/bits/utilities/popper-layer/popper-layer.svelte";
	import { noop } from "$lib/primitives/internal/noop.js";
	import { isHTMLElement } from "$lib/primitives/internal/is.js";
	import { getFloatingContentCSSVars } from "$lib/primitives/internal/floating-svelte/floating-utils.svelte.js";
	import PopperLayerForceMount from "$lib/primitives/bits/utilities/popper-layer/popper-layer-force-mount.svelte";

	const uid = $props.id();

	let {
		id = createId(uid),
		ref = $bindable(null),
		children,
		child,
		loop = true,
		onInteractOutside = noop,
		forceMount = false,
		onEscapeKeydown = noop,
		interactOutsideBehavior = "defer-otherwise-close",
		escapeKeydownBehavior = "defer-otherwise-close",
		onOpenAutoFocus: onOpenAutoFocusProp = noop,
		onCloseAutoFocus: onCloseAutoFocusProp = noop,
		onFocusOutside = noop,
		side = "right",
		align = "start",
		alignOffset = 0,
		onPlaced = noop,
		trapFocus = false,
		style,
		...restProps
	}: MenuSubContentProps = $props();

	const subContentState = MenuContentState.create({
		id: boxWith(() => id),
		loop: boxWith(() => loop),
		ref: boxWith(
			() => ref,
			(v) => (ref = v)
		),
		isSub: true,
		onCloseAutoFocus: boxWith(() => handleCloseAutoFocus),
	});

	function onkeydown(e: KeyboardEvent) {
		const isKeyDownInside = (e.currentTarget as HTMLElement).contains(e.target as HTMLElement);
		const isCloseKey = SUB_CLOSE_KEYS[
			subContentState.parentMenu.root.opts.dir.current
		].includes(e.key);
		if (isKeyDownInside && isCloseKey) {
			if (subContentState.virtualFocus) {
				subContentState.parentMenu.pendingOpenModality = "preview";
				subContentState.parentMenu.root.activateDataMenuSurface(
					subContentState.parentMenu.parentMenu?.contentId.current ?? null
				);
			} else {
				subContentState.parentMenu.onClose();
				const triggerNode = subContentState.parentMenu.triggerNode;
				triggerNode?.focus();
			}
			e.preventDefault();
		}
	}

	const dataAttr = $derived(subContentState.parentMenu.root.getBitsAttr("sub-content"));
	let listAlignOffset = $state(0);
	let measureFrame: number | null = null;
	const resolvedAlign = $derived(align === "list" ? "start" : align);
	const resolvedAlignOffset = $derived(
		(alignOffset ?? 0) + (align === "list" ? listAlignOffset : 0)
	);

	function clearMeasureFrame() {
		if (measureFrame === null) return;
		subContentState.domContext.getWindow().cancelAnimationFrame(measureFrame);
		measureFrame = null;
	}

	function getNearestScrollableAncestor(target: HTMLElement, boundary: HTMLElement) {
		let node: HTMLElement | null = target.parentElement;
		while (node && boundary.contains(node)) {
			if (node.scrollHeight - node.clientHeight > 1) {
				const overflowY = node.ownerDocument.defaultView?.getComputedStyle(node).overflowY;
				if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
					return node;
				}
			}
			if (node === boundary) break;
			node = node.parentElement;
		}
		return null;
	}

	function measureListAlign() {
		measureFrame = null;
		if (align !== "list" || (side !== "right" && side !== "left")) {
			listAlignOffset = 0;
			return;
		}
		const contentNode = subContentState.parentMenu.contentNode;
		if (!contentNode) {
			listAlignOffset = 0;
			return;
		}
		const contentRect = contentNode.getBoundingClientRect();
		const itemAttr = subContentState.parentMenu.root.getBitsAttr("item");
		const firstRow = contentNode.querySelector<HTMLElement>(
			`[${itemAttr}]:not([data-disabled])`
		);
		if (!firstRow) {
			listAlignOffset = 0;
			return;
		}
		const rowRect = firstRow.getBoundingClientRect();
		const scroller = getNearestScrollableAncestor(firstRow, contentNode);
		listAlignOffset = Math.round(contentRect.top - rowRect.top - (scroller?.scrollTop ?? 0));
	}

	function queueMeasureListAlign() {
		if (align !== "list") return;
		clearMeasureFrame();
		measureFrame = subContentState.domContext
			.getWindow()
			.requestAnimationFrame(measureListAlign);
	}

	function measureListAlignAndQueueRemeasure() {
		if (align !== "list") return;
		clearMeasureFrame();
		measureListAlign();
		queueMeasureListAlign();
	}

	$effect(() => {
		if (align !== "list") {
			listAlignOffset = 0;
			return;
		}
		if (!subContentState.parentMenu.opts.open.current) {
			listAlignOffset = 0;
			return;
		}
		afterTick(measureListAlignAndQueueRemeasure);
	});

	$effect(() => {
		if (align !== "list") return;
		const contentNode = subContentState.parentMenu.contentNode;
		if (!contentNode) return;
		const win = contentNode.ownerDocument.defaultView;
		if (!win) return;
		const mutationObserver = new win.MutationObserver(queueMeasureListAlign);
		mutationObserver.observe(contentNode, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["data-state", "style", "hidden"],
		});
		const resizeObserver = new win.ResizeObserver(queueMeasureListAlign);
		resizeObserver.observe(contentNode);
		return () => {
			mutationObserver.disconnect();
			resizeObserver.disconnect();
			clearMeasureFrame();
		};
	});

	const mergedProps = $derived(
		mergeProps(restProps, subContentState.props, {
			side,
			align: resolvedAlign,
			alignOffset: resolvedAlignOffset,
			onPlaced: handlePlaced,
			onkeydown,
			[dataAttr]: "",
		})
	);

	function handleOpenAutoFocus(e: Event) {
		onOpenAutoFocusProp(e);
		if (e.defaultPrevented) return;
		e.preventDefault();
		if (
			subContentState.parentMenu.root.isUsingKeyboard &&
			subContentState.parentMenu.contentNode
		) {
			MenuOpenEvent.dispatch(subContentState.parentMenu.contentNode);
		}
	}

	function handleCloseAutoFocus(e: Event) {
		onCloseAutoFocusProp(e);
		if (e.defaultPrevented) return;
		e.preventDefault();
	}

	function handleInteractOutside(e: PointerEvent) {
		onInteractOutside(e);
		if (e.defaultPrevented) return;
		subContentState.parentMenu.onClose();
	}

	function handleEscapeKeydown(e: KeyboardEvent) {
		onEscapeKeydown(e);
		if (e.defaultPrevented) return;
		subContentState.parentMenu.onClose();
	}

	function handlePlaced() {
		onPlaced();
		measureListAlignAndQueueRemeasure();
	}

	function handleOnFocusOutside(e: FocusEvent) {
		onFocusOutside(e);
		if (e.defaultPrevented) return;
		if (!isHTMLElement(e.target)) return;
		if (e.target.id === subContentState.parentMenu.triggerNode?.id) return;
		const parentContent = subContentState.parentMenu.parentMenu?.contentNode;
		if (parentContent?.contains(e.target)) {
			const parentContentId =
				subContentState.parentMenu.parentMenu?.contentId.current ?? null;
			if (
				subContentState.virtualFocus &&
				subContentState.parentMenu.root.activeDataMenuContentId === parentContentId
			) {
				e.preventDefault();
				return;
			}
			subContentState.parentMenu.onClose();
			e.preventDefault();
			return;
		}
		// focus moved to a descendant sub-content rendered in a portal
		const subContentSelector = `[${subContentState.parentMenu.root.getBitsAttr("sub-content")}]`;
		if (e.target.closest(subContentSelector)) {
			e.preventDefault();
			return;
		}
		subContentState.parentMenu.onClose();
	}
</script>

{#if forceMount}
	<PopperLayerForceMount
		{...mergedProps}
		ref={subContentState.opts.ref}
		{interactOutsideBehavior}
		{escapeKeydownBehavior}
		onOpenAutoFocus={handleOpenAutoFocus}
		enabled={subContentState.parentMenu.opts.open.current}
		onInteractOutside={handleInteractOutside}
		onEscapeKeydown={handleEscapeKeydown}
		onFocusOutside={handleOnFocusOutside}
		preventScroll={false}
		{loop}
		{trapFocus}
		shouldRender={subContentState.shouldRender}
	>
		{#snippet popper({ props, wrapperProps })}
			{@const finalProps = mergeProps(
				props,
				mergedProps,
				{ style: getFloatingContentCSSVars("menu") },
				{ style }
			)}
			{#if child}
				{@render child({
					props: finalProps,
					wrapperProps,
					...subContentState.snippetProps,
				})}
			{:else}
				<div {...wrapperProps}>
					<div {...finalProps}>
						{@render children?.()}
					</div>
				</div>
			{/if}
		{/snippet}
	</PopperLayerForceMount>
{:else if !forceMount}
	<PopperLayer
		{...mergedProps}
		ref={subContentState.opts.ref}
		{interactOutsideBehavior}
		{escapeKeydownBehavior}
		onCloseAutoFocus={handleCloseAutoFocus}
		onOpenAutoFocus={handleOpenAutoFocus}
		open={subContentState.parentMenu.opts.open.current}
		onInteractOutside={handleInteractOutside}
		onEscapeKeydown={handleEscapeKeydown}
		onFocusOutside={handleOnFocusOutside}
		preventScroll={false}
		{loop}
		{trapFocus}
		shouldRender={subContentState.shouldRender}
	>
		{#snippet popper({ props, wrapperProps })}
			{@const finalProps = mergeProps(
				props,
				mergedProps,
				{ style: getFloatingContentCSSVars("menu") },
				{ style }
			)}
			{#if child}
				{@render child({
					props: finalProps,
					wrapperProps,
					...subContentState.snippetProps,
				})}
			{:else}
				<div {...wrapperProps}>
					<div {...finalProps}>
						{@render children?.()}
					</div>
				</div>
			{/if}
		{/snippet}
	</PopperLayer>
{/if}
