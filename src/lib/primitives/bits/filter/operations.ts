import { DEFAULT_OPERATORS, determineNewOperator } from "./operators.js";
import type {
	Column,
	ColumnDataType,
	FilterModel,
	FilterOperations,
	FiltersState,
	OptionBasedColumnDataType,
} from "./types.js";
import { addUniq, removeUniq, uniq } from "./array.js";
import {
	createBigIntFilterValue,
	createDateFilterValue,
	createNumberFilterValue,
} from "./helpers.js";

export const filterOperations: FilterOperations = {
	addFilterValue<TData, TType extends OptionBasedColumnDataType>(
		filters: FiltersState,
		column: Column<TData, TType>,
		values: FilterModel<TType>["values"]
	): FiltersState {
		if (column.type !== "option" && column.type !== "multiOption") {
			throw new Error("[filter] addFilterValue() is only supported for option columns");
		}

		const filter = filters.find((f) => f.columnId === column.id);
		const isColumnFiltered = filter && filter.values.length > 0;

		if (!isColumnFiltered) {
			return [
				...filters,
				{
					columnId: column.id,
					type: column.type,
					operator:
						values.length > 1
							? DEFAULT_OPERATORS[column.type]!.multiple
							: DEFAULT_OPERATORS[column.type]!.single,
					values,
				} as FilterModel<TType>,
			];
		}

		const oldValues = filter.values as FilterModel<TType>["values"];
		const newValues = addUniq(oldValues, values);
		const newOperator = determineNewOperator(
			column.type,
			oldValues,
			newValues,
			filter.operator as any
		);

		if (newValues.length === 0) {
			return filters.filter((f) => f.columnId !== column.id);
		}

		return filters.map((f) =>
			f.columnId === column.id
				? ({
						columnId: column.id,
						type: column.type,
						operator: newOperator,
						values: newValues,
					} as FilterModel<TType>)
				: f
		);
	},

	removeFilterValue<TData, TType extends OptionBasedColumnDataType>(
		filters: FiltersState,
		column: Column<TData, TType>,
		value: FilterModel<TType>["values"]
	): FiltersState {
		if (column.type !== "option" && column.type !== "multiOption") {
			throw new Error("[filter] removeFilterValue() is only supported for option columns");
		}

		const filter = filters.find((f) => f.columnId === column.id);
		const isColumnFiltered = filter && filter.values.length > 0;
		if (!isColumnFiltered) return filters;

		const oldValues = filter.values as FilterModel<TType>["values"];
		const newValues = removeUniq(oldValues, value);
		const newOperator = determineNewOperator(
			column.type,
			oldValues,
			newValues,
			filter.operator as any
		);

		if (newValues.length === 0) {
			return filters.filter((f) => f.columnId !== column.id);
		}

		return filters.map((f) =>
			f.columnId === column.id
				? ({
						columnId: column.id,
						type: column.type,
						operator: newOperator,
						values: newValues,
					} as FilterModel<TType>)
				: f
		);
	},

	setFilterValue<TData, TType extends ColumnDataType>(
		filters: FiltersState,
		column: Column<TData, TType>,
		values: FilterModel<TType>["values"]
	): FiltersState {
		const filter = filters.find((f) => f.columnId === column.id);
		const isColumnFiltered = filter && filter.values.length > 0;

		const newValues =
			column.type === "number"
				? createNumberFilterValue(values as number[])
				: column.type === "bigint"
					? createBigIntFilterValue(values as bigint[])
					: column.type === "date"
						? createDateFilterValue(values as [Date, Date] | [Date] | [] | undefined)
						: uniq(values);

		if (newValues.length === 0) return filters;

		if (!isColumnFiltered) {
			return [
				...filters,
				{
					columnId: column.id,
					type: column.type,
					operator:
						newValues.length > 1
							? DEFAULT_OPERATORS[column.type]!.multiple
							: DEFAULT_OPERATORS[column.type]!.single,
					values: newValues,
				} as FilterModel<TType>,
			];
		}

		const oldValues = filter.values as FilterModel<TType>["values"];
		const newOperator = determineNewOperator(
			column.type,
			oldValues,
			newValues as FilterModel<TType>["values"],
			filter.operator as any
		);

		const newFilter = {
			columnId: column.id,
			type: column.type,
			operator: newOperator,
			values: newValues,
		} as FilterModel<TType>;

		return filters.map((f) => (f.columnId === column.id ? newFilter : f));
	},

	setFilterOperator<TType extends ColumnDataType>(
		filters: FiltersState,
		columnId: string,
		operator: FilterModel<TType>["operator"]
	): FiltersState {
		return filters.map((f) => (f.columnId === columnId ? { ...f, operator } : f));
	},

	removeFilter(filters: FiltersState, columnId: string): FiltersState {
		return filters.filter((f) => f.columnId !== columnId);
	},

	removeAllFilters(): FiltersState {
		return [];
	},
};
