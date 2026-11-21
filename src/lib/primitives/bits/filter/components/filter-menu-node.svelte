<script lang="ts" generics="TContext = any">
	import MenuItem from "$lib/primitives/bits/menu/components/menu-item.svelte";
	import MenuCheckboxItem from "$lib/primitives/bits/menu/components/menu-checkbox-item.svelte";
	import MenuRadioGroup from "$lib/primitives/bits/menu/components/menu-radio-group.svelte";
	import MenuRadioItem from "$lib/primitives/bits/menu/components/menu-radio-item.svelte";
	import MenuGroup from "$lib/primitives/bits/menu/components/menu-group.svelte";
	import MenuSeparator from "$lib/primitives/bits/menu/components/menu-separator.svelte";
	import MenuSub from "$lib/primitives/bits/menu/components/menu-sub.svelte";
	import MenuSubTrigger from "$lib/primitives/bits/menu/components/menu-sub-trigger.svelte";
	import MenuSubContent from "$lib/primitives/bits/menu/components/menu-sub-content.svelte";
	import Portal from "$lib/primitives/bits/utilities/portal/portal.svelte";
	import DataSurface from "$lib/primitives/bits/menu-data/components/data-surface.svelte";
	import DataInput from "$lib/primitives/bits/menu-data/components/data-input.svelte";
	import DataList from "$lib/primitives/bits/menu-data/components/data-list.svelte";
	import DataEmpty from "$lib/primitives/bits/menu-data/components/data-empty.svelte";
	import type { DisplayNode, DisplayRowNode } from "$lib/primitives/bits/menu-data/types.js";
	import {
		isDisplayGroupNode,
		isDisplayRadioGroupNode,
		isDisplaySeparatorNode,
	} from "$lib/primitives/bits/menu-data/types.js";
	import type {
		Column,
		DataTableFilterActions,
		DurationUnit,
		FilterModel,
		FilterStrategy,
		FiltersState,
		Locale,
	} from "../types.js";
	import { filterAttrs } from "../filter.svelte.js";
	import { t } from "../i18n.js";
	import { formatNumberWithUnit } from "../units.js";
	import type { FilterMenuNodeMeta } from "../menu-nodes.js";
	import FilterLabelWithBreadcrumbs from "./filter-label-with-breadcrumbs.svelte";
	import FilterTextEditor from "./filter-text-editor.svelte";
	import FilterNumberEditor from "./filter-number-editor.svelte";
	import FilterOptionEditor from "./filter-option-editor.svelte";
	import FilterDateEditor from "./filter-date-editor.svelte";
	import FilterIcon from "./filter-icon.svelte";
	import Self from "./filter-menu-node.svelte";

	let {
		displayNode,
		actions,
		filters = [],
		locale = "en",
		strategy = "client",
	}: {
		displayNode: DisplayNode<FilterMenuNodeMeta>;
		actions: DataTableFilterActions<TContext>;
		filters?: FiltersState;
		locale?: Locale;
		strategy?: FilterStrategy;
	} = $props();

	function rowLabel(row: DisplayRowNode<FilterMenuNodeMeta>) {
		const node = row.node;
		if (node.kind === "submenu") return node.label ?? node.title;
		if (node.meta?.kind === "operator") return node.meta.label;
		return node.label;
	}

	function findFilter<TType extends FilterModel["type"]>(column: Column<unknown>, type: TType) {
		return filters.find(
			(filter): filter is FilterModel<TType> =>
				filter.columnId === column.id && filter.type === type
		);
	}

	function unitLabel(value: number, unit?: DurationUnit) {
		if (!unit) return String(Math.round(value * 1000) / 1000);
		return formatNumberWithUnit(value, unit);
	}

	function numberDisplay(
		data: NonNullable<Extract<FilterMenuNodeMeta, { kind: "number" }>["data"]>
	) {
		const [first, second] = data.values;
		if (data.isRange) {
			return `${unitLabel(first ?? 0, data.displayUnit)} ${t("and", locale)} ${unitLabel(
				second ?? 0,
				data.displayUnit
			)}`;
		}
		return unitLabel(first ?? 0, data.displayUnit);
	}

	function getSubmenuAlign(meta: FilterMenuNodeMeta | undefined) {
		if (meta?.kind !== "column") return "list";
		return meta.editor === "option" || meta.editor === "multiOption" || !meta.editor
			? "list"
			: "start";
	}
</script>

{#if isDisplayGroupNode(displayNode)}
	<MenuGroup aria-label={displayNode.group.label}>
		{#each displayNode.items as item (`group-${displayNode.group.id}-${item.node.id}`)}
			<Self displayNode={item} {actions} {filters} {locale} {strategy} />
		{/each}
	</MenuGroup>
{:else if isDisplayRadioGroupNode(displayNode)}
	<MenuRadioGroup
		value={displayNode.radioGroup.value ?? ""}
		onValueChange={(value) => displayNode.radioGroup.onValueChange?.(value)}
		aria-label={displayNode.radioGroup.label}
	>
		{#each displayNode.items as item (`radio-${displayNode.radioGroup.id}-${item.node.id}`)}
			<Self displayNode={item} {actions} {filters} {locale} {strategy} />
		{/each}
	</MenuRadioGroup>
{:else if isDisplaySeparatorNode(displayNode)}
	<MenuSeparator />
{:else}
	{@const row = displayNode}
	{@const node = row.node}
	{#if node.kind === "submenu"}
		{@const meta = node.meta}
		{@const column = meta?.kind === "column" ? meta.column : undefined}
		<MenuSub>
			<MenuSubTrigger id={node.id} disabled={node.disabled} openDelay={0}>
				<span>
					{#if column?.icon}
						<FilterIcon icon={column.icon} part="menu" />
					{/if}
					<FilterLabelWithBreadcrumbs
						label={rowLabel(row)}
						breadcrumbs={row.context.isDeepSearchResult ? row.context.breadcrumbs : []}
					/>
				</span>
				<span aria-hidden="true" {...{ [filterAttrs["menu-caret"]]: "" }}>
					<svg viewBox="0 0 15 15" focusable="false">
						<path d="M6 11V4l4.5 3.5L6 11Z" fill="currentColor" />
					</svg>
				</span>
			</MenuSubTrigger>
			<Portal>
				<MenuSubContent
					sideOffset={8}
					align={getSubmenuAlign(meta)}
					collisionAvoidance={{ side: "flip", align: "shift" }}
				>
					{#if column && meta?.kind === "column" && meta.editor === "text"}
						<FilterTextEditor column={column as Column<unknown, "text">} {actions} />
					{:else if column && meta?.kind === "column" && meta.editor === "number"}
						<FilterNumberEditor
							column={column as Column<unknown, "number">}
							{actions}
							baseUnit={(
								column.meta as { number?: { unit?: DurationUnit } } | undefined
							)?.number?.unit}
						/>
					{:else if column && meta?.kind === "column" && meta.editor === "date"}
						<FilterDateEditor
							filter={findFilter(column, "date") as FilterModel<"date"> | undefined}
							column={column as Column<unknown, "date">}
							{actions}
						/>
					{:else if column && meta?.kind === "column" && (meta.editor === "option" || meta.editor === "multiOption")}
						<FilterOptionEditor
							column={column as
								| Column<unknown, "option">
								| Column<unknown, "multiOption">}
							{actions}
							filter={findFilter(column, meta.editor) as
								| FilterModel<"option">
								| FilterModel<"multiOption">
								| undefined}
							{locale}
							{strategy}
						/>
					{:else}
						<DataSurface content={node.nodes ?? []}>
							<DataInput
								placeholder={meta?.kind === "column"
									? meta.inputPlaceholder
									: "Search..."}
							/>
							<DataList>
								{#snippet children({ nodes })}
									{#each nodes as childNode, index (`submenu-${node.id}-${index}`)}
										<Self
											displayNode={childNode}
											{actions}
											{filters}
											{locale}
											{strategy}
										/>
									{/each}
								{/snippet}
							</DataList>
							<DataEmpty>No matching options.</DataEmpty>
						</DataSurface>
					{/if}
				</MenuSubContent>
			</Portal>
		</MenuSub>
	{:else if node.kind === "checkbox-item"}
		{@const option = node.meta?.kind === "option" ? node.meta.option : undefined}
		<MenuCheckboxItem
			id={node.id}
			checked={node.checked ?? false}
			onCheckedChange={(checked) => node.onCheckedChange?.(checked)}
			disabled={node.disabled}
			closeOnSelect={node.closeOnSelect ?? false}
		>
			{#snippet children({ checked })}
				<span
					aria-hidden="true"
					data-state={checked ? "checked" : "unchecked"}
					{...{ [filterAttrs["menu-checkbox-indicator"]]: "" }}
				>
					<svg viewBox="0 0 24 24" focusable="false">
						<path
							d="m20 6-11 11-5-5"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</span>
				<span>
					{#if option?.icon}
						<FilterIcon icon={option.icon} part="menu" />
					{/if}
					<FilterLabelWithBreadcrumbs
						label={option?.label ?? node.label}
						breadcrumbs={row.context.isDeepSearchResult ? row.context.breadcrumbs : []}
					/>
				</span>
				{#if option?.count}
					<span {...{ [filterAttrs["menu-count"]]: "" }}>
						{new Intl.NumberFormat().format(option.count)}
					</span>
				{/if}
			{/snippet}
		</MenuCheckboxItem>
	{:else if node.meta?.kind === "operator"}
		{@const shortcut = node.shortcut ?? node.meta.shortcut}
		<MenuRadioItem
			id={node.id}
			value={node.value ?? node.id}
			disabled={node.disabled}
			closeOnSelect={node.closeOnSelect ?? true}
		>
			<span>{node.meta.label}</span>
			{#if shortcut}
				<span aria-hidden="true" {...{ [filterAttrs["menu-shortcut"]]: "" }}>
					{shortcut}
				</span>
			{/if}
		</MenuRadioItem>
	{:else}
		<MenuItem
			id={node.id}
			disabled={node.disabled}
			closeOnSelect={node.closeOnSelect ?? true}
			onSelect={() => node.onSelect?.()}
		>
			{#if node.meta?.kind === "boolean" && node.meta.column.icon}
				<FilterIcon icon={node.meta.column.icon} part="menu" />
			{/if}
			{#if node.meta?.kind === "text"}
				<span>{node.meta.data.operator}</span>
				<span>{node.meta.data.values[0]}</span>
			{:else if node.meta?.kind === "number"}
				<span>{node.meta.data.operator}</span>
				<span>{numberDisplay(node.meta.data)}</span>
			{:else}
				<FilterLabelWithBreadcrumbs
					label={rowLabel(row)}
					breadcrumbs={row.context.isDeepSearchResult ? row.context.breadcrumbs : []}
				/>
			{/if}
		</MenuItem>
	{/if}
{/if}
