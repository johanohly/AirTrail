<script lang="ts">
	import type { FilterProviderProps } from "../types.js";
	import { setFilterContext } from "../filter.svelte.js";

	let {
		columns,
		filters,
		actions,
		strategy,
		locale = "en",
		entityName,
		variant,
		children,
	}: FilterProviderProps = $props();

	setFilterContext({
		get columns() {
			return columns;
		},
		get filters() {
			return filters;
		},
		get actions() {
			return actions;
		},
		get strategy() {
			return strategy;
		},
		get locale() {
			return locale;
		},
		get entityName() {
			return entityName;
		},
		get variant() {
			return variant;
		},
	});
</script>

{@render children?.()}
