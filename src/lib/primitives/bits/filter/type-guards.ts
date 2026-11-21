import type { Column, ColumnDataType, FilterModel } from "./types.js";

export function isColumnType<TData, TType extends ColumnDataType>(
	column: Column<TData>,
	type: TType
): column is Column<TData, TType> {
	return column.type === type;
}

export function isTextColumn<TData>(column: Column<TData>): column is Column<TData, "text"> {
	return column.type === "text";
}

export function isOptionColumn<TData>(column: Column<TData>): column is Column<TData, "option"> {
	return column.type === "option";
}

export function isMultiOptionColumn<TData>(
	column: Column<TData>
): column is Column<TData, "multiOption"> {
	return column.type === "multiOption";
}

export function isOptionBasedColumn<TData>(
	column: Column<TData>
): column is Column<TData, "option"> | Column<TData, "multiOption"> {
	return column.type === "option" || column.type === "multiOption";
}

export function isDateColumn<TData>(column: Column<TData>): column is Column<TData, "date"> {
	return column.type === "date";
}

export function isNumberColumn<TData>(column: Column<TData>): column is Column<TData, "number"> {
	return column.type === "number";
}

export function isBigIntColumn<TData>(column: Column<TData>): column is Column<TData, "bigint"> {
	return column.type === "bigint";
}

export function isNumericColumn<TData>(
	column: Column<TData>
): column is Column<TData, "number"> | Column<TData, "bigint"> {
	return column.type === "number" || column.type === "bigint";
}

export function isBooleanColumn<TData>(
	column: Column<TData>
): column is Column<TData, "boolean"> {
	return column.type === "boolean";
}

export function isFilterType<TType extends ColumnDataType>(
	filter: FilterModel,
	type: TType
): filter is FilterModel<TType> {
	return filter.type === type;
}

export function isTextFilter(filter: FilterModel): filter is FilterModel<"text"> {
	return filter.type === "text";
}

export function isOptionFilter(filter: FilterModel): filter is FilterModel<"option"> {
	return filter.type === "option";
}

export function isMultiOptionFilter(filter: FilterModel): filter is FilterModel<"multiOption"> {
	return filter.type === "multiOption";
}

export function isOptionBasedFilter(
	filter: FilterModel
): filter is FilterModel<"option"> | FilterModel<"multiOption"> {
	return filter.type === "option" || filter.type === "multiOption";
}

export function isDateFilter(filter: FilterModel): filter is FilterModel<"date"> {
	return filter.type === "date";
}

export function isNumberFilter(filter: FilterModel): filter is FilterModel<"number"> {
	return filter.type === "number";
}

export function isBigIntFilter(filter: FilterModel): filter is FilterModel<"bigint"> {
	return filter.type === "bigint";
}

export function isNumericFilter(
	filter: FilterModel
): filter is FilterModel<"number"> | FilterModel<"bigint"> {
	return filter.type === "number" || filter.type === "bigint";
}

export function isBooleanFilter(filter: FilterModel): filter is FilterModel<"boolean"> {
	return filter.type === "boolean";
}
