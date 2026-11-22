<script lang="ts">
	import { mergeProps } from "svelte-toolbelt";
	import type { DataInputProps } from "../types.js";
	import { dataMenuAttrs, useDataMenuSurfaceContext } from "../menu-data.svelte.js";
	import { noop } from "$lib/primitives/internal/noop.js";
	import { kbd } from "$lib/primitives/internal/kbd.js";

	let {
		value,
		onValueChange = noop,
		visibility,
		hideUntilActive = false,
		ref = $bindable(null),
		type = "text",
		oninput,
		onkeydown,
		onfocus,
		...restProps
	}: DataInputProps = $props();

	const surface = useDataMenuSurfaceContext();
	const initialVisibility = visibility ?? (hideUntilActive ? "typing" : "always");
	surface.setInputVisibility(initialVisibility);
	const resolvedVisibility = $derived(visibility ?? (hideUntilActive ? "typing" : "always"));
	const inputValue = $derived(value ?? surface.search);
	const shouldRender = $derived(surface.shouldRenderInput);

	$effect(() => {
		surface.setInputVisibility(resolvedVisibility);
	});

	$effect(() => {
		surface.inputNode = ref;
	});

	function updateValue(nextValue: string) {
		surface.setSearch(nextValue);
		onValueChange(nextValue);
	}

	function stopNavigationEvent(event: KeyboardEvent) {
		event.preventDefault();
		event.stopPropagation();
		event.stopImmediatePropagation();
	}

	function handleInput(event: Event) {
		oninput?.(event as Event & { currentTarget: EventTarget & HTMLInputElement });
		if (event.defaultPrevented) return;
		updateValue((event.currentTarget as HTMLInputElement).value);
	}

	function handleFocus(event: FocusEvent) {
		onfocus?.(event as FocusEvent & { currentTarget: EventTarget & HTMLInputElement });
		if (event.defaultPrevented) return;
		surface.activate();
	}

	function handleKeydown(event: KeyboardEvent) {
		onkeydown?.(event as KeyboardEvent & { currentTarget: EventTarget & HTMLInputElement });
		if (event.defaultPrevented) return;

		const isModifierKey = event.ctrlKey || event.altKey || event.metaKey;
		const isPrintableKey = event.key.length === 1;
		if (!isModifierKey && isPrintableKey && surface.selectShortcut(event.key)) {
			stopNavigationEvent(event);
			return;
		}

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

		if (event.key === kbd.ENTER) {
			stopNavigationEvent(event);
			surface.selectHighlighted();
			return;
		}

		if (isPrintableKey || event.key === kbd.BACKSPACE || event.key === kbd.DELETE) {
			event.stopPropagation();
			event.stopImmediatePropagation();
		}
	}

	const mergedProps = $derived(
		mergeProps(restProps, {
			type,
			value: inputValue,
			role: "combobox",
			"aria-autocomplete": "list",
			"aria-expanded": true,
			"aria-controls": surface.listNode?.id,
			"aria-activedescendant": surface.highlightedId ?? undefined,
			oninput: handleInput,
			onkeydown: handleKeydown,
			onfocus: handleFocus,
			[dataMenuAttrs.input]: "",
		})
	);
</script>

{#if shouldRender}
	<input bind:this={ref} {...mergedProps} />
{/if}
