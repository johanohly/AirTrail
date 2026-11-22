<script
	lang="ts"
	generics="TData = unknown, TType extends import('../types.js').ColumnDataType = import('../types.js').ColumnDataType, TContext = any"
>
	import { mergeProps } from "svelte-toolbelt";
	import Root from "$lib/primitives/bits/menu/components/menu.svelte";
	import Trigger from "$lib/primitives/bits/menu/components/menu-trigger.svelte";
	import Portal from "$lib/primitives/bits/utilities/portal/portal.svelte";
	import Content from "$lib/primitives/bits/dropdown-menu/components/dropdown-menu-content.svelte";
	import type { FilterValueProps } from "../types.js";
	import {
		filterAttrs,
		useFilterActions,
		useFilterContext,
		useFilterItemContext,
	} from "../filter.svelte.js";
	import {
		isBooleanColumn,
		isDateColumn,
		isMultiOptionColumn,
		isNumberColumn,
		isOptionColumn,
		isTextColumn,
	} from "../type-guards.js";
	import FilterValueDisplay from "./filter-value-display.svelte";
	import FilterTextEditor from "./filter-text-editor.svelte";
	import FilterNumberEditor from "./filter-number-editor.svelte";
	import FilterDateEditor from "./filter-date-editor.svelte";
	import FilterOptionEditor from "./filter-option-editor.svelte";
	import type { Column, DurationUnit, FilterModel } from "../types.js";

	let {
		filter: filterProp,
		column: columnProp,
		actions: actionsProp,
		strategy: strategyProp,
		locale: localeProp,
		entityName: entityNameProp,
		children,
		child: childProp,
		ref = $bindable(null),
		type = "button",
		variant,
		...restProps
	}: FilterValueProps<TData, TType, TContext> = $props();

	const context = useFilterContext<TData, TContext>();
	const itemContext = useFilterItemContext<TData, TType, TContext>();
	const fallbackActions = useFilterActions<TContext>();
	const filter = $derived(filterProp ?? itemContext?.filter);
	const column = $derived(columnProp ?? itemContext?.column);
	const actions = $derived(actionsProp ?? itemContext?.actions ?? fallbackActions);
	const strategy = $derived(strategyProp ?? itemContext?.strategy ?? context.strategy);
	const locale = $derived(localeProp ?? itemContext?.locale ?? context.locale ?? "en");
	const entityName = $derived(entityNameProp ?? itemContext?.entityName ?? context.entityName);
	const resolvedVariant = $derived(variant ?? itemContext?.variant ?? context.variant);
	let open = $state(false);
	let initialValues = $state<Array<string | number | bigint | boolean | Date>>([]);

	function handleOpenChange(value: boolean) {
		if (value && filter) {
			initialValues = [...filter.values];
		}
		open = value;
	}

	const triggerProps = $derived(
		mergeProps(restProps, {
			type,
			"data-column-type": column?.type,
			"data-variant": resolvedVariant,
			[filterAttrs.value]: "",
		})
	);
</script>

{#if !filter || !column || !actions || !strategy}
	{@const _error = (() => {
		throw new Error(
			"Filter.Value requires filter/column/actions/strategy props or must be used within Filter.Item"
		);
	})()}
{:else if isBooleanColumn(column)}
	{#if childProp}
		{@render childProp({ props: triggerProps })}
	{:else}
		<button bind:this={ref} {...triggerProps}>
			{#if children}
				{@render children()}
			{:else}
				<FilterValueDisplay {filter} {column} {locale} {entityName} />
			{/if}
		</button>
	{/if}
{:else}
	<Root bind:open onOpenChange={handleOpenChange}>
		<Trigger>
			{#snippet child({ props })}
				{@const delegatedProps = mergeProps(props, triggerProps)}
				{#if childProp}
					{@render childProp({ props: delegatedProps })}
				{:else}
					<button bind:this={ref} {...delegatedProps}>
						{#if children}
							{@render children()}
						{:else}
							<FilterValueDisplay {filter} {column} {locale} {entityName} />
						{/if}
					</button>
				{/if}
			{/snippet}
		</Trigger>
		<Portal>
			<Content align="start" sideOffset={8}>
				{#if isTextColumn(column)}
					<FilterTextEditor column={column as Column<unknown, "text">} {actions} />
				{:else if isDateColumn(column)}
					<FilterDateEditor
						filter={filter as FilterModel<"date">}
						column={column as Column<unknown, "date">}
						{actions}
					/>
				{:else if isNumberColumn(column)}
					<FilterNumberEditor
						column={column as Column<unknown, "number">}
						{actions}
						baseUnit={(column.meta as { number?: { unit?: DurationUnit } } | undefined)
							?.number?.unit}
					/>
				{:else if isOptionColumn(column) || isMultiOptionColumn(column)}
					<FilterOptionEditor
						column={column as
							| Column<unknown, "option">
							| Column<unknown, "multiOption">}
						{actions}
						filter={filter as FilterModel<"option"> | FilterModel<"multiOption">}
						{locale}
						{strategy}
						{initialValues}
						showSeparator
					/>
				{/if}
			</Content>
		</Portal>
	</Root>
{/if}
