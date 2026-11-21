<script
	lang="ts"
	generics="TData = unknown, TType extends import('../types.js').ColumnDataType = import('../types.js').ColumnDataType"
>
	import type { Column, FilterModel, Locale } from "../types.js";
	import {
		isBooleanColumn,
		isBooleanFilter,
		isDateColumn,
		isDateFilter,
		isMultiOptionColumn,
		isMultiOptionFilter,
		isNumberColumn,
		isNumberFilter,
		isOptionColumn,
		isOptionFilter,
		isTextColumn,
		isTextFilter,
	} from "../type-guards.js";
	import { take } from "../array.js";
	import { t } from "../i18n.js";
	import FilterIcon from "./filter-icon.svelte";

	let {
		filter,
		column,
		locale = "en",
	}: {
		filter: FilterModel<TType>;
		column: Column<TData, TType>;
		locale?: Locale;
		entityName?: string;
	} = $props();

	const monthNames = [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
	];

	function formatDate(value: Date, includeYear = true) {
		const label = `${monthNames[value.getMonth()]} ${value.getDate()}`;
		return includeYear ? `${label}, ${value.getFullYear()}` : label;
	}

	function formatDateRange(start: Date, end: Date) {
		const sameMonth = start.getMonth() === end.getMonth();
		const sameYear = start.getFullYear() === end.getFullYear();
		if (sameMonth && sameYear)
			return `${formatDate(start, false)} - ${end.getDate()}, ${end.getFullYear()}`;
		if (sameYear) return `${formatDate(start, false)} - ${formatDate(end)}`;
		return `${formatDate(start)} - ${formatDate(end)}`;
	}

	const selectedOptions = $derived.by(() => {
		if (!(isOptionColumn(column) || isMultiOptionColumn(column))) return [];
		if (!(isOptionFilter(filter) || isMultiOptionFilter(filter))) return [];
		return column.getOptions().filter((option) => filter.values.includes(option.value));
	});

	const optionDisplayName = $derived.by(() => {
		if (column.pluralName) return column.pluralName.toLowerCase();
		const name = column.displayName.toLowerCase();
		if (column.type !== "option") return name;
		return name.endsWith("s") ? `${name}es` : `${name}s`;
	});
</script>

{#if (isOptionColumn(column) && isOptionFilter(filter)) || (isMultiOptionColumn(column) && isMultiOptionFilter(filter))}
	{#if selectedOptions.length === 1 && selectedOptions[0]}
		<span>
			{#if selectedOptions[0].icon}
				<FilterIcon icon={selectedOptions[0].icon} part="value" />
			{/if}
			<span>{selectedOptions[0].label}</span>
		</span>
	{:else}
		<span>
			{#if selectedOptions.length > 0 && selectedOptions.every((option) => option.icon)}
				<span>
					{#each take(selectedOptions, 3) as option (option.value)}
						<FilterIcon icon={option.icon} part="value" />
					{/each}
				</span>
			{/if}
			<span>{selectedOptions.length} {optionDisplayName}</span>
		</span>
	{/if}
{:else if isDateColumn(column) && isDateFilter(filter)}
	{#if filter.values.length === 0}
		<span>...</span>
	{:else if filter.values.length === 1 && filter.values[0]}
		<span>{formatDate(filter.values[0])}</span>
	{:else if filter.values.length === 2 && filter.values[0] && filter.values[1]}
		<span>{formatDateRange(filter.values[0], filter.values[1])}</span>
	{/if}
{:else if isTextColumn(column) && isTextFilter(filter)}
	{#if filter.values.length === 0 || !filter.values[0]?.trim()}
		<span>...</span>
	{:else}
		<span>{filter.values[0]}</span>
	{/if}
{:else if isNumberColumn(column) && isNumberFilter(filter)}
	{#if filter.operator === "is between" || filter.operator === "is not between"}
		<span>{filter.values[0]} {t("and", locale)} {filter.values[1]}</span>
	{:else}
		<span>{filter.values[0]}</span>
	{/if}
{:else if isBooleanColumn(column) && isBooleanFilter(filter)}
	<span>{column.toggledStateName}</span>
{/if}
