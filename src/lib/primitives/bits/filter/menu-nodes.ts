import type {
	CheckboxItemDef,
	ItemDef,
	NodeDef,
	RadioGroupDef,
	SubmenuDef,
} from "$lib/primitives/bits/menu-data/types.js";
import {
	booleanFilterOperators,
	dateFilterOperators,
	multiOptionFilterOperators,
	numberFilterOperators,
	optionFilterOperators,
	textFilterOperators,
} from "./operators.js";
import { parseNumberInput } from "./units.js";
import { t } from "./i18n.js";
import type {
	Column,
	ColumnDataType,
	ColumnOptionExtended,
	DataTableFilterActions,
	DurationUnit,
	FilterIcon,
	FilterMenuGroup,
	FilterModel,
	FilterStrategy,
	Locale,
	NumberFilterOperator,
	TextFilterOperator,
} from "./types.js";
import {
	isBooleanColumn,
	isDateColumn,
	isMultiOptionColumn,
	isNumberColumn,
	isOptionColumn,
	isTextColumn,
} from "./type-guards.js";

export interface TextFilterItemData {
	operator: TextFilterOperator;
	values: string[];
}

export interface NumberFilterItemData {
	operator: NumberFilterOperator;
	values: number[];
	isRange: boolean;
	displayUnit?: DurationUnit;
}

export type FilterMenuNodeMeta =
	| {
			kind: "column";
			column: Column<unknown>;
			editor?: ColumnDataType;
			inputPlaceholder?: string;
	  }
	| {
			kind: "option";
			option: ColumnOptionExtended;
			column: Column<unknown, "option" | "multiOption">;
	  }
	| { kind: "text"; data: TextFilterItemData }
	| { kind: "number"; data: NumberFilterItemData }
	| { kind: "operator"; label: string; shortcut?: string }
	| { kind: "boolean"; column: Column<unknown, "boolean"> }
	| { kind: "custom"; icon?: FilterIcon; search?: boolean };

export type FilterNodeDef = NodeDef<FilterMenuNodeMeta>;
export type FilterItemDef = ItemDef<FilterMenuNodeMeta>;
export type FilterCheckboxItemDef = CheckboxItemDef<FilterMenuNodeMeta>;
export type FilterSubmenuDef = SubmenuDef<FilterMenuNodeMeta>;

export function createTextFilterItems<TData>({
	query,
	column,
	actions,
}: {
	query: string;
	column: Column<TData, "text">;
	actions: DataTableFilterActions;
}): FilterItemDef[] {
	if (!query.trim()) return [];

	function changeText(value: string, operator: TextFilterOperator) {
		actions.batch((tx) => {
			tx.setFilterValue(column, [String(value)]);
			tx.setFilterOperator(column.id, operator);
		});
	}

	return [
		{
			kind: "item",
			id: `${column.id}-text-contains-${query}`,
			label: `contains ${query}`,
			keywords: [query],
			onSelect: () => changeText(query, "contains"),
			meta: { kind: "text", data: { operator: "contains", values: [query] } },
		},
		{
			kind: "item",
			id: `${column.id}-text-does-not-contain-${query}`,
			label: `does not contain ${query}`,
			keywords: [query],
			onSelect: () => changeText(query, "does not contain"),
			meta: {
				kind: "text",
				data: { operator: "does not contain", values: [query] },
			},
		},
	];
}

const SINGLE_VALUE_OPERATORS: NumberFilterOperator[] = [
	"is",
	"is not",
	"is greater than",
	"is greater than or equal to",
	"is less than",
	"is less than or equal to",
];

const RANGE_OPERATORS: NumberFilterOperator[] = ["is between", "is not between"];

export function createNumberFilterItems<TData>({
	query,
	column,
	actions,
	baseUnit = "ms",
}: {
	query: string;
	column: Column<TData, "number">;
	actions: DataTableFilterActions;
	baseUnit?: DurationUnit;
}): FilterItemDef[] {
	if (!query.trim()) return [];

	const parsed = parseNumberInput(query, baseUnit);
	if (!parsed) return [];

	function changeNumber(values: number[], operator: NumberFilterOperator) {
		actions.batch((tx) => {
			tx.setFilterValue(column, values);
			tx.setFilterOperator(column.id, operator);
		});
	}

	const displayUnit = baseUnit && baseUnit !== "ms" ? baseUnit : undefined;

	if (parsed.isRange && parsed.rangeValues) {
		const [min, max] = parsed.rangeValues;
		return RANGE_OPERATORS.map((operator) => ({
			kind: "item" as const,
			id: `${column.id}-number-${operator.replace(/\s+/g, "-")}-${min}-${max}`,
			label: `${operator} ${min} and ${max}`,
			keywords: [query, String(min), String(max)],
			onSelect: () => changeNumber([min, max], operator),
			meta: {
				kind: "number",
				data: { operator, values: [min, max], isRange: true, displayUnit },
			},
		}));
	}

	const value = parsed.value;
	return SINGLE_VALUE_OPERATORS.map((operator) => ({
		kind: "item" as const,
		id: `${column.id}-number-${operator.replace(/\s+/g, "-")}-${value}`,
		label: `${operator} ${value}`,
		keywords: [query, String(value)],
		onSelect: () => changeNumber([value], operator),
		meta: {
			kind: "number",
			data: { operator, values: [value], isRange: false, displayUnit },
		},
	}));
}

function createSelectableMenuInternal({
	column,
	actions,
	filter,
}: {
	column: Column<unknown, "option"> | Column<unknown, "multiOption">;
	actions: DataTableFilterActions;
	filter?: FilterModel<"option"> | FilterModel<"multiOption">;
}): FilterCheckboxItemDef[] {
	const counts = column.getFacetedUniqueValues();
	return column.getOptions().map((option) => {
		const selected = filter?.values.includes(option.value) ?? false;
		const optionData: ColumnOptionExtended = {
			value: option.value,
			label: option.label,
			icon: option.icon,
			count: counts?.get(option.value) ?? option.count ?? 0,
			keywords: option.keywords,
			description: option.description,
		};

		return {
			kind: "checkbox-item" as const,
			id: `${column.id}-option-${option.value}`,
			label: option.label,
			keywords: option.keywords,
			checked: selected,
			onCheckedChange: (checked: boolean) => {
				if (checked) {
					actions.addFilterValue(column as Column<unknown, "option">, [option.value]);
				} else {
					actions.removeFilterValue(column as Column<unknown, "option">, [option.value]);
				}
			},
			closeOnSelect: false,
			meta: { kind: "option", option: optionData, column },
		};
	});
}

export function createOptionMenu<TData>({
	column,
	actions,
	filter,
}: {
	column: Column<TData, "option">;
	actions: DataTableFilterActions;
	filter?: FilterModel<"option">;
}): FilterCheckboxItemDef[] {
	return createSelectableMenuInternal({
		column: column as unknown as Column<unknown, "option">,
		actions,
		filter,
	});
}

export function createMultiOptionMenu<TData>({
	column,
	actions,
	filter,
}: {
	column: Column<TData, "multiOption">;
	actions: DataTableFilterActions;
	filter?: FilterModel<"multiOption">;
}): FilterCheckboxItemDef[] {
	return createSelectableMenuInternal({
		column: column as unknown as Column<unknown, "multiOption">,
		actions,
		filter,
	});
}

function getOperatorRecord(column: Column<unknown>) {
	if (isTextColumn(column)) return textFilterOperators;
	if (isOptionColumn(column)) return optionFilterOperators;
	if (isMultiOptionColumn(column)) return multiOptionFilterOperators;
	if (isDateColumn(column)) return dateFilterOperators;
	if (isNumberColumn(column)) return numberFilterOperators;
	if (isBooleanColumn(column)) return booleanFilterOperators;
	return {};
}

export function createOperatorNodes<TData, TType extends ColumnDataType>({
	filter,
	column,
	actions,
	locale,
}: {
	filter: FilterModel<TType>;
	column: Column<TData, TType>;
	actions: DataTableFilterActions;
	locale: Locale;
}): Array<RadioGroupDef<FilterMenuNodeMeta>> {
	const operators = getOperatorRecord(column as Column<unknown>) as Record<string, any>;
	const currentOperator = operators[filter.operator];
	const currentTarget =
		currentOperator?.target === "any"
			? filter.values.length > 1
				? "multiple"
				: "single"
			: currentOperator?.target;
	const relatedOperators = Object.values(operators).filter(
		(operator: any) =>
			currentTarget && (operator.target === currentTarget || operator.target === "any")
	);

	return [
		{
			kind: "radio-group",
			id: "operators",
			value: filter.operator,
			onValueChange: (value) => actions.setFilterOperator(column.id, value as any),
			nodes: relatedOperators.map((operator: any, index): FilterItemDef => {
				const label = t(operator.key, locale);
				const shortcut = index < 9 ? String(index + 1) : undefined;
				return {
					kind: "item",
					id: operator.value,
					value: operator.value,
					label,
					shortcut,
					closeOnSelect: true,
					meta: { kind: "operator", label, shortcut },
				};
			}),
		},
	];
}

export function createColumnNodes<TData>({
	columns,
	filters,
	actions,
	locale,
	strategy,
}: {
	columns: Column<TData>[];
	filters: FilterModel[];
	actions: DataTableFilterActions;
	locale: Locale;
	strategy: FilterStrategy;
}): FilterNodeDef[] {
	return columns
		.filter((column) => !column.hidden)
		.map((column): FilterNodeDef => {
			if (isTextColumn(column)) {
				return {
					kind: "submenu",
					id: column.id,
					title: column.displayName,
					label: column.displayName,
					meta: {
						kind: "column",
						column: column as Column<unknown>,
						editor: "text",
						inputPlaceholder: "Type to filter...",
					},
				};
			}

			if (isNumberColumn(column)) {
				const unit = (column.meta as { number?: { unit?: DurationUnit } } | undefined)
					?.number?.unit;
				return {
					kind: "submenu",
					id: column.id,
					title: column.displayName,
					label: column.displayName,
					meta: {
						kind: "column",
						column: column as Column<unknown>,
						editor: "number",
						inputPlaceholder:
							unit && unit !== "ms"
								? "Type number or duration (e.g. 1hr, 30min)..."
								: "Type a number...",
					},
				};
			}

			if (isDateColumn(column)) {
				return {
					kind: "submenu",
					id: column.id,
					title: column.displayName,
					label: column.displayName,
					meta: { kind: "column", column: column as Column<unknown>, editor: "date" },
				};
			}

			if (isBooleanColumn(column)) {
				return {
					kind: "item",
					id: `filter-value-${column.id}`,
					label: column.displayName,
					onSelect: () => actions.setFilterValue(column, [false]),
					meta: { kind: "boolean", column: column as Column<unknown, "boolean"> },
				};
			}

			if (isOptionColumn(column)) {
				const filter = filters.find(
					(f): f is FilterModel<"option"> =>
						f.columnId === column.id && f.type === "option"
				);
				const nodes = createOptionMenu({ column, actions, filter });
				return {
					kind: "submenu",
					id: column.id,
					title: column.displayName,
					label: column.displayName,
					nodes,
					meta: {
						kind: "column",
						column: column as Column<unknown>,
						editor: "option",
						inputPlaceholder: `Search ${column.displayName.toLowerCase()}...`,
					},
				};
			}

			if (isMultiOptionColumn(column)) {
				const filter = filters.find(
					(f): f is FilterModel<"multiOption"> =>
						f.columnId === column.id && f.type === "multiOption"
				);
				const nodes = createMultiOptionMenu({ column, actions, filter });
				return {
					kind: "submenu",
					id: column.id,
					title: column.displayName,
					label: column.displayName,
					nodes,
					meta: {
						kind: "column",
						column: column as Column<unknown>,
						editor: "multiOption",
						inputPlaceholder: `Search ${column.displayName.toLowerCase()}...`,
					},
				};
			}

			void strategy;
			return {
				kind: "submenu",
				id: column.id,
				title: column.displayName,
				label: column.displayName,
				meta: { kind: "column", column: column as Column<unknown> },
			};
		});
}

export function createGroupedColumnNodes<TData>({
	groups,
	...opts
}: Parameters<typeof createColumnNodes<TData>>[0] & {
	groups: FilterMenuGroup[];
}): FilterNodeDef[] {
	const columnNodes = createColumnNodes(opts);
	const groupOf = (node: FilterNodeDef) =>
		node.meta?.kind === "column" || node.meta?.kind === "boolean"
			? node.meta.column.group
			: undefined;
	const knownGroups = new Set(groups.map((group) => group.id));
	const result: FilterNodeDef[] = [];

	for (const group of groups) {
		const nodes = [
			...(group.nodes ?? []),
			...columnNodes.filter((node) => groupOf(node) === group.id),
		];
		if (!nodes.length) continue;
		if (result.length) result.push({ kind: "separator", id: `${group.id}-separator` });
		result.push({ kind: "group", id: group.id, label: group.label, nodes });
	}

	const ungrouped = columnNodes.filter((node) => {
		const group = groupOf(node);
		return !group || !knownGroups.has(group);
	});
	if (ungrouped.length && result.length) {
		result.push({ kind: "separator", id: "ungrouped-separator" });
	}
	result.push(...ungrouped);
	return result;
}
