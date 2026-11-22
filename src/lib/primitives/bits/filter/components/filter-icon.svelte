<script lang="ts">
	import type { Component, Snippet } from "svelte";
	import { filterAttrs } from "../filter.svelte.js";
	import type { FilterIcon } from "../types.js";

	let {
		icon,
		part,
		size = 16,
		class: className,
	}: {
		icon?: FilterIcon;
		part: "subject" | "menu" | "value";
		size?: number;
		class?: string;
	} = $props();

	function isComponentIcon(value: FilterIcon | undefined) {
		if (typeof value !== "function") return false;
		if (value.length >= 2) return true;
		return Boolean(value.prototype && "$destroy" in value.prototype);
	}

	const IconComponent = $derived.by(() => {
		if (!isComponentIcon(icon)) return undefined;
		return icon as Component<Record<string, unknown>>;
	});

	const iconSnippet = $derived.by(() => {
		if (!icon || isComponentIcon(icon)) return undefined;
		return icon as Snippet;
	});

	const partAttrs = $derived.by(() => {
		if (part === "subject") return { [filterAttrs["subject-icon"]]: "" };
		if (part === "value") return { [filterAttrs["value-icon"]]: "" };
		return { [filterAttrs["menu-icon"]]: "" };
	});
</script>

{#if IconComponent || iconSnippet}
	<span aria-hidden="true" class={className} {...partAttrs}>
		{#if IconComponent}
			<IconComponent {size} aria-hidden="true" />
		{:else if iconSnippet}
			{@render iconSnippet()}
		{/if}
	</span>
{/if}
