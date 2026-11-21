import { Context } from "runed";
import { createBitsAttrs } from "$lib/primitives/internal/attrs.js";
import { createColumns } from "./columns.js";
import { filterOperations } from "./operations.js";
import type {
	BatchFilterOperations,
	BigIntColumnIds,
	Column,
	ColumnConfig,
	ColumnDataType,
	DataTableFilterActions,
	DataTableFiltersInstance,
	DataTableFiltersOptions,
	FilterContextValue,
	FilterItemContextValue,
	FilterModel,
	FilterStrategy,
	FiltersState,
	NumberColumnIds,
	OptionBasedColumnDataType,
	OptionColumnIds,
} from "./types.js";
import { isColumnOptionArray, isColumnOptionMap, isMinMaxTuple } from "./helpers.js";

export const filterAttrs = createBitsAttrs({
	component: "filter",
	parts: [
		"provider",
		"root",
		"trigger",
		"menu",
		"menu-content",
		"menu-input",
		"menu-empty",
		"menu-caret",
		"menu-group-heading",
		"menu-checkbox-indicator",
		"menu-count",
		"menu-description",
		"menu-icon",
		"menu-shortcut",
		"date-editor",
		"date-fields",
		"date-field",
		"date-label",
		"date-field-input",
		"date-segment",
		"date-calendar",
		"date-calendar-header",
		"date-calendar-nav",
		"date-calendar-heading",
		"date-calendar-heading-button",
		"date-calendar-grid",
		"date-calendar-head-cell",
		"date-calendar-cell",
		"date-calendar-day",
		"date-calendar-mode-panel",
		"date-calendar-mode-option",
		"date-clear",
		"list",
		"list-mobile-container",
		"item",
		"subject",
		"subject-icon",
		"operator",
		"value",
		"value-display",
		"value-icon",
		"value-editor",
		"remove",
		"actions",
	],
});

const FilterContext = new Context<FilterContextValue>("Filter.Provider");
const FilterItemContext = new Context<FilterItemContextValue>("Filter.Item");

export function setFilterContext<TData = unknown, TContext = any>(
	value: FilterContextValue<TData, TContext>
) {
	return FilterContext.set(value as FilterContextValue);
}

export function useFilterContext<TData = unknown, TContext = any>() {
	return FilterContext.get() as FilterContextValue<TData, TContext>;
}

export function setFilterItemContext<
	TData = unknown,
	TType extends ColumnDataType = ColumnDataType,
	TContext = any,
>(value: FilterItemContextValue<TData, TType, TContext>) {
	return FilterItemContext.set(value as FilterItemContextValue);
}

export function useFilterItemContext<
	TData = unknown,
	TType extends ColumnDataType = ColumnDataType,
	TContext = any,
>() {
	return FilterItemContext.getOr(null) as FilterItemContextValue<TData, TType, TContext> | null;
}

export function useFilterColumn<TData = unknown>(columnId: string): Column<TData> | undefined {
	return useFilterContext<TData>().columns.find((col) => col.id === columnId);
}

export function useFilterActions<TContext = any>() {
	return useFilterContext<unknown, TContext>().actions;
}

export function useFilterStrategy() {
	return useFilterContext().strategy;
}

export function useFilterLocale() {
	return useFilterContext().locale;
}

export function useFilterEntityName() {
	return useFilterContext().entityName;
}

export function useFilterVariant() {
	return useFilterContext().variant;
}

export function useDataTableFilters<
	TData,
	TColumns extends ReadonlyArray<ColumnConfig<TData, any, any, any>>,
	TStrategy extends FilterStrategy,
	TContext = any,
>({
	strategy,
	data,
	columnsConfig,
	defaultFilters,
	filters: externalFilters,
	onFiltersChange,
	options,
	faceted,
	entityName,
}: DataTableFiltersOptions<TData, TColumns, TStrategy, TContext>): DataTableFiltersInstance<
	TData,
	TStrategy,
	TContext
> {
	let internalFilters = $state<FiltersState>(defaultFilters ?? []);

	if (
		(externalFilters !== undefined && !onFiltersChange) ||
		(externalFilters === undefined && onFiltersChange)
	) {
		throw new Error("If using controlled state, specify both filters and onFiltersChange.");
	}

	const isControlled = externalFilters !== undefined && onFiltersChange !== undefined;
	const filters = $derived(isControlled ? (externalFilters ?? []) : internalFilters);

	const columns = $derived.by(() => {
		const enhancedConfigs = columnsConfig.map((config) => {
			let final = config;

			if (options && (config.type === "option" || config.type === "multiOption")) {
				const optionsInput = options[config.id as OptionColumnIds<TColumns>];
				if (optionsInput && isColumnOptionArray(optionsInput)) {
					final = { ...final, options: optionsInput };
				}
			}

			if ((config.type === "option" || config.type === "multiOption") && faceted) {
				const facetedOptionsInput = faceted[config.id as OptionColumnIds<TColumns>];
				if (facetedOptionsInput && isColumnOptionMap(facetedOptionsInput)) {
					final = { ...final, facetedOptions: facetedOptionsInput };
				}
			}

			if (config.type === "number" && faceted) {
				const minMaxTuple = faceted[config.id as NumberColumnIds<TColumns>];
				if (minMaxTuple && isMinMaxTuple<number>(minMaxTuple, "number")) {
					final = { ...final, min: minMaxTuple[0], max: minMaxTuple[1] };
				}
			}

			if (config.type === "bigint" && faceted) {
				const minMaxTuple = faceted[config.id as BigIntColumnIds<TColumns>];
				if (minMaxTuple && isMinMaxTuple<bigint>(minMaxTuple, "bigint")) {
					final = { ...final, min: minMaxTuple[0], max: minMaxTuple[1] };
				}
			}

			return final;
		});

		return createColumns(data, enhancedConfigs, strategy);
	});

	function emitFiltersChange(prev: FiltersState, next: FiltersState, context?: TContext) {
		if (!onFiltersChange) return;
		if (onFiltersChange.length <= 1) {
			(onFiltersChange as (value: FiltersState) => void)(next);
			return;
		}
		(onFiltersChange as (prev: FiltersState, next: FiltersState, context?: TContext) => void)(
			prev,
			next,
			context
		);
	}

	function setFilters(
		nextFilters: FiltersState | ((prev: FiltersState) => FiltersState),
		context?: TContext
	) {
		const prevFilters = filters;
		const resolvedNextFilters =
			typeof nextFilters === "function" ? nextFilters(prevFilters) : nextFilters;

		if (isControlled) {
			emitFiltersChange(prevFilters, resolvedNextFilters, context);
		} else {
			internalFilters = resolvedNextFilters;
		}
	}

	const actions: DataTableFilterActions<TContext> = {
		addFilterValue<TActionData, TType extends OptionBasedColumnDataType>(
			column: Column<TActionData, TType>,
			values: FilterModel<TType>["values"],
			context?: TContext
		) {
			setFilters((prev) => filterOperations.addFilterValue(prev, column, values), context);
		},

		removeFilterValue<TActionData, TType extends OptionBasedColumnDataType>(
			column: Column<TActionData, TType>,
			value: FilterModel<TType>["values"],
			context?: TContext
		) {
			setFilters((prev) => filterOperations.removeFilterValue(prev, column, value), context);
		},

		setFilterValue<TActionData, TType extends ColumnDataType>(
			column: Column<TActionData, TType>,
			values: FilterModel<TType>["values"],
			context?: TContext
		) {
			setFilters((prev) => filterOperations.setFilterValue(prev, column, values), context);
		},

		setFilterOperator<TType extends ColumnDataType>(
			columnId: string,
			operator: FilterModel<TType>["operator"],
			context?: TContext
		) {
			setFilters(
				(prev) => filterOperations.setFilterOperator(prev, columnId, operator),
				context
			);
		},

		removeFilter(columnId: string, context?: TContext) {
			setFilters((prev) => filterOperations.removeFilter(prev, columnId), context);
		},

		removeAllFilters(context?: TContext) {
			setFilters((prev) => filterOperations.removeAllFilters(prev), context);
		},

		batch(callback: (batchActions: BatchFilterOperations) => void, context?: TContext) {
			setFilters((prevFilters) => {
				let transactionFilters = prevFilters;
				const batchActions: BatchFilterOperations = {
					addFilterValue<TActionData, TType extends OptionBasedColumnDataType>(
						column: Column<TActionData, TType>,
						values: FilterModel<TType>["values"]
					) {
						transactionFilters = filterOperations.addFilterValue(
							transactionFilters,
							column,
							values
						);
					},
					removeFilterValue<TActionData, TType extends OptionBasedColumnDataType>(
						column: Column<TActionData, TType>,
						value: FilterModel<TType>["values"]
					) {
						transactionFilters = filterOperations.removeFilterValue(
							transactionFilters,
							column,
							value
						);
					},
					setFilterValue<TActionData, TType extends ColumnDataType>(
						column: Column<TActionData, TType>,
						values: FilterModel<TType>["values"]
					) {
						transactionFilters = filterOperations.setFilterValue(
							transactionFilters,
							column,
							values
						);
					},
					setFilterOperator<TType extends ColumnDataType>(
						columnId: string,
						operator: FilterModel<TType>["operator"]
					) {
						transactionFilters = filterOperations.setFilterOperator(
							transactionFilters,
							columnId,
							operator
						);
					},
					removeFilter(columnId: string) {
						transactionFilters = filterOperations.removeFilter(
							transactionFilters,
							columnId
						);
					},
					removeAllFilters() {
						transactionFilters = filterOperations.removeAllFilters(transactionFilters);
					},
				};

				callback(batchActions);
				return transactionFilters;
			}, context);
		},
	};

	return {
		get columns() {
			return columns;
		},
		get filters() {
			return filters;
		},
		actions,
		strategy,
		entityName,
	};
}

export function createTypedDataTableFilters<TContext>() {
	return function useTypedDataTableFilters<
		TData,
		TColumns extends ReadonlyArray<ColumnConfig<TData, any, any, any>>,
		TStrategy extends FilterStrategy,
	>(options: DataTableFiltersOptions<TData, TColumns, TStrategy, TContext>) {
		return useDataTableFilters<TData, TColumns, TStrategy, TContext>(options);
	};
}
