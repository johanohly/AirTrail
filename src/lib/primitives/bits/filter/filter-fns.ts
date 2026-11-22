import { dateFilterOperators } from "./operators.js";
import type { FilterModel, FiltersState } from "./types.js";
import { intersection } from "./array.js";
import { getValidBigInt, getValidNumber, isValidNumber } from "./helpers.js";

function startOfDay(date: Date) {
	const value = new Date(date);
	value.setHours(0, 0, 0, 0);
	return value;
}

function endOfDay(date: Date) {
	const value = new Date(date);
	value.setHours(23, 59, 59, 999);
	return value;
}

function isSameDay(a: Date, b: Date) {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

function setEquals(a: string[], b: string[]) {
	const aSet = new Set(a);
	const bSet = new Set(b);
	return aSet.size === bSet.size && [...aSet].every((value) => bSet.has(value));
}

export function optionFilterFn(inputData: string, filterValue: FilterModel<"option">) {
	if (!inputData) return false;
	if (filterValue.values.length === 0) return true;

	const value = inputData.toString().toLowerCase();
	const found = filterValue.values.some((v) => v.toLowerCase() === value);

	switch (filterValue.operator) {
		case "is":
		case "is any of":
			return found;
		case "is not":
		case "is none of":
			return !found;
	}
}

export function multiOptionFilterFn(inputData: string[], filterValue: FilterModel<"multiOption">) {
	if (!inputData) return false;

	if (filterValue.values.length === 0 || !filterValue.values[0]) return true;

	const values = inputData;
	const filterValues = filterValue.values;

	switch (filterValue.operator) {
		case "include":
		case "include any of":
			return intersection(values, filterValues).length > 0;
		case "exclude":
		case "exclude if any of":
			return intersection(values, filterValues).length === 0;
		case "include all of":
			return intersection(values, filterValues).length === filterValues.length;
		case "exclude if all":
			return intersection(values, filterValues).length !== filterValues.length;
		case "include exactly":
			return setEquals(values, filterValues);
		case "exclude exactly":
			return !setEquals(values, filterValues);
	}
}

export function dateFilterFn(inputData: Date, filterValue: FilterModel<"date">) {
	if (!filterValue || filterValue.values.length === 0) return true;

	if (
		dateFilterOperators[filterValue.operator].target === "single" &&
		filterValue.values.length > 1
	) {
		throw new Error("Singular operators require at most one filter value");
	}

	if (
		(filterValue.operator === "is between" || filterValue.operator === "is not between") &&
		filterValue.values.length !== 2
	) {
		throw new Error("Plural operators require two filter values");
	}

	const d1 = filterValue.values[0]!;
	const d2 = filterValue.values[1]!;
	const value = inputData;

	switch (filterValue.operator) {
		case "is":
			return isSameDay(value, d1);
		case "is not":
			return !isSameDay(value, d1);
		case "is before":
			return value.getTime() < startOfDay(d1).getTime();
		case "is on or after":
			return isSameDay(value, d1) || value.getTime() > startOfDay(d1).getTime();
		case "is after":
			return value.getTime() > startOfDay(d1).getTime();
		case "is on or before":
			return isSameDay(value, d1) || value.getTime() < startOfDay(d1).getTime();
		case "is between":
			return (
				value.getTime() >= startOfDay(d1).getTime() &&
				value.getTime() <= endOfDay(d2).getTime()
			);
		case "is not between":
			return (
				value.getTime() < startOfDay(d1).getTime() ||
				value.getTime() > endOfDay(d2).getTime()
			);
	}
}

export function textFilterFn(inputData: string, filterValue: FilterModel<"text">) {
	if (!filterValue || filterValue.values.length === 0) return true;

	const value = inputData.toLowerCase().trim();
	const filterStr = filterValue.values[0]!.toLowerCase().trim();
	if (filterStr === "") return true;

	const found = value.includes(filterStr);

	switch (filterValue.operator) {
		case "contains":
			return found;
		case "does not contain":
			return !found;
	}
}

export function numberFilterFn(inputData: number, filterValue: FilterModel<"number">): boolean {
	if (!filterValue || !filterValue.values || filterValue.values.length === 0) return true;

	const value = inputData;
	const filterVal = getValidNumber(filterValue.values[0]);
	if (filterVal === undefined) return true;
	if (!isValidNumber(value)) return false;

	switch (filterValue.operator) {
		case "is":
			return value === filterVal;
		case "is not":
			return value !== filterVal;
		case "is greater than":
			if (filterVal === Number.POSITIVE_INFINITY) return false;
			if (filterVal === Number.NEGATIVE_INFINITY) return true;
			return value > filterVal;
		case "is greater than or equal to":
			if (filterVal === Number.POSITIVE_INFINITY) return value === Number.POSITIVE_INFINITY;
			if (filterVal === Number.NEGATIVE_INFINITY) return true;
			return value >= filterVal;
		case "is less than":
			if (filterVal === Number.NEGATIVE_INFINITY) return false;
			if (filterVal === Number.POSITIVE_INFINITY) return value !== Number.POSITIVE_INFINITY;
			return value < filterVal;
		case "is less than or equal to":
			if (filterVal === Number.NEGATIVE_INFINITY) return value === Number.NEGATIVE_INFINITY;
			if (filterVal === Number.POSITIVE_INFINITY) return true;
			return value <= filterVal;
		case "is between": {
			const lowerBound = getValidNumber(filterValue.values[0]);
			const upperBound = getValidNumber(filterValue.values[1]);
			if (lowerBound === undefined || upperBound === undefined) return true;

			const actualLower = Math.min(lowerBound, upperBound);
			const actualUpper = Math.max(lowerBound, upperBound);
			if (
				actualLower === Number.NEGATIVE_INFINITY &&
				actualUpper === Number.POSITIVE_INFINITY
			) {
				return true;
			}
			if (
				actualLower === Number.POSITIVE_INFINITY ||
				actualUpper === Number.NEGATIVE_INFINITY
			) {
				return false;
			}
			return value >= actualLower && value <= actualUpper;
		}
		case "is not between": {
			const lowerBound = getValidNumber(filterValue.values[0]);
			const upperBound = getValidNumber(filterValue.values[1]);
			if (lowerBound === undefined || upperBound === undefined) return true;

			const actualLower = Math.min(lowerBound, upperBound);
			const actualUpper = Math.max(lowerBound, upperBound);
			if (
				actualLower === Number.NEGATIVE_INFINITY &&
				actualUpper === Number.POSITIVE_INFINITY
			) {
				return false;
			}
			if (
				actualLower === Number.POSITIVE_INFINITY ||
				actualUpper === Number.NEGATIVE_INFINITY
			) {
				return true;
			}
			return value < actualLower || value > actualUpper;
		}
		default:
			return true;
	}
}

export function bigIntFilterFn(inputData: bigint, filterValue: FilterModel<"bigint">): boolean {
	if (!filterValue || !filterValue.values || filterValue.values.length === 0) return true;

	const value = inputData;
	const filterVal = getValidBigInt(filterValue.values[0]);
	if (filterVal === undefined) return true;
	if (typeof value !== "bigint") return false;

	switch (filterValue.operator) {
		case "is":
			return value === filterVal;
		case "is not":
			return value !== filterVal;
		case "is greater than":
			return value > filterVal;
		case "is greater than or equal to":
			return value >= filterVal;
		case "is less than":
			return value < filterVal;
		case "is less than or equal to":
			return value <= filterVal;
		case "is between": {
			const lowerBound = getValidBigInt(filterValue.values[0]);
			const upperBound = getValidBigInt(filterValue.values[1]);
			if (lowerBound === undefined || upperBound === undefined) return true;

			const actualLower = lowerBound < upperBound ? lowerBound : upperBound;
			const actualUpper = lowerBound < upperBound ? upperBound : lowerBound;
			return value >= actualLower && value <= actualUpper;
		}
		case "is not between": {
			const lowerBound = getValidBigInt(filterValue.values[0]);
			const upperBound = getValidBigInt(filterValue.values[1]);
			if (lowerBound === undefined || upperBound === undefined) return true;

			const actualLower = lowerBound < upperBound ? lowerBound : upperBound;
			const actualUpper = lowerBound < upperBound ? upperBound : lowerBound;
			return value < actualLower || value > actualUpper;
		}
		default:
			return true;
	}
}

export function booleanFilterFn(inputData: boolean, filterValue: FilterModel<"boolean">) {
	if (!filterValue || filterValue.values.length === 0) return true;

	if (filterValue.values.some((v) => typeof v === "undefined")) {
		throw new Error("Cannot create boolean filter value from undefined values");
	}

	const value = inputData;
	const filterVal = filterValue.values[0] ?? false;

	switch (filterValue.operator) {
		case "is":
			return value === filterVal;
		case "is not":
			return value !== filterVal;
		default:
			return true;
	}
}

export function filterRow(row: any, filters: FiltersState) {
	for (const filter of filters) {
		const cell = row[filter.columnId];
		if (filter.type === "text" && !textFilterFn(cell, filter as FilterModel<"text">))
			return false;
		if (filter.type === "number" && !numberFilterFn(cell, filter as FilterModel<"number">)) {
			return false;
		}
		if (filter.type === "bigint" && !bigIntFilterFn(cell, filter as FilterModel<"bigint">)) {
			return false;
		}
		if (filter.type === "date" && !dateFilterFn(cell, filter as FilterModel<"date">))
			return false;
		if (filter.type === "boolean" && !booleanFilterFn(cell, filter as FilterModel<"boolean">)) {
			return false;
		}
		if (filter.type === "option" && !optionFilterFn(cell, filter as FilterModel<"option">)) {
			return false;
		}
		if (
			filter.type === "multiOption" &&
			!multiOptionFilterFn(cell, filter as FilterModel<"multiOption">)
		) {
			return false;
		}
	}
	return true;
}

export function filterData<TData>(data: TData[], filters: FiltersState): TData[] {
	return data.filter((row) => filterRow(row, filters));
}

export const filterFns = {
	text: textFilterFn,
	number: numberFilterFn,
	bigint: bigIntFilterFn,
	date: dateFilterFn,
	boolean: booleanFilterFn,
	option: optionFilterFn,
	multiOption: multiOptionFilterFn,
	row: filterRow,
	data: filterData,
};
