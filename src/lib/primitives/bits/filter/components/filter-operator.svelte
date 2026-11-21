<script
	lang="ts"
	generics="TData = unknown, TType extends import('../types.js').ColumnDataType = import('../types.js').ColumnDataType, TContext = any"
>
	import { mergeProps } from "svelte-toolbelt";
	import Root from "$lib/primitives/bits/menu/components/menu.svelte";
	import Trigger from "$lib/primitives/bits/menu/components/menu-trigger.svelte";
	import Portal from "$lib/primitives/bits/utilities/portal/portal.svelte";
	import Content from "$lib/primitives/bits/dropdown-menu/components/dropdown-menu-content.svelte";
	import DataSurface from "$lib/primitives/bits/menu-data/components/data-surface.svelte";
	import DataInput from "$lib/primitives/bits/menu-data/components/data-input.svelte";
	import DataList from "$lib/primitives/bits/menu-data/components/data-list.svelte";
	import DataEmpty from "$lib/primitives/bits/menu-data/components/data-empty.svelte";
	import type { FilterOperatorProps } from "../types.js";
	import {
		filterAttrs,
		useFilterActions,
		useFilterContext,
		useFilterItemContext,
	} from "../filter.svelte.js";
	import { filterTypeOperatorDetails } from "../operators.js";
	import { t } from "../i18n.js";
	import { createOperatorNodes } from "../menu-nodes.js";
	import FilterMenuNode from "./filter-menu-node.svelte";

	let {
		column: columnProp,
		filter: filterProp,
		actions: actionsProp,
		locale: localeProp,
		children,
		child: childProp,
		ref = $bindable(null),
		type = "button",
		variant,
		...restProps
	}: FilterOperatorProps<TData, TType, TContext> = $props();

	const context = useFilterContext<TData, TContext>();
	const itemContext = useFilterItemContext<TData, TType, TContext>();
	const fallbackActions = useFilterActions<TContext>();
	const column = $derived(columnProp ?? itemContext?.column);
	const filter = $derived(filterProp ?? itemContext?.filter);
	const actions = $derived(actionsProp ?? itemContext?.actions ?? fallbackActions);
	const locale = $derived(localeProp ?? itemContext?.locale ?? context.locale ?? "en");
	const resolvedVariant = $derived(variant ?? itemContext?.variant ?? context.variant);
	const nodes = $derived(
		column && filter && actions ? createOperatorNodes({ filter, column, actions, locale }) : []
	);
	const operatorLabel = $derived.by(() => {
		if (!column || !filter) return "";
		const details = filterTypeOperatorDetails[column.type] as Record<string, { key: string }>;
		const operator = details[filter.operator];
		return operator ? t(operator.key, locale) : filter.operator;
	});
	const triggerProps = $derived(
		mergeProps(restProps, {
			type,
			"data-column-type": column?.type,
			"data-operator": filter?.operator,
			"data-variant": resolvedVariant,
			[filterAttrs.operator]: "",
		})
	);
</script>

{#if !column || !filter || !actions}
	{@const _error = (() => {
		throw new Error(
			"Filter.Operator requires column/filter/actions props or must be used within Filter.Item"
		);
	})()}
{:else}
	<Root>
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
							{operatorLabel}
						{/if}
					</button>
				{/if}
			{/snippet}
		</Trigger>
		<Portal>
			<Content align="start" sideOffset={8}>
				<DataSurface content={nodes}>
					<DataInput hideUntilActive />
					<DataList>
						{#snippet children({ nodes: displayNodes })}
							{#each displayNodes as node, index (`operator-${index}-${"kind" in node ? node.kind : node.node.id}`)}
								<FilterMenuNode displayNode={node} {actions} {locale} />
							{/each}
						{/snippet}
					</DataList>
					<DataEmpty />
				</DataSurface>
			</Content>
		</Portal>
	</Root>
{/if}
