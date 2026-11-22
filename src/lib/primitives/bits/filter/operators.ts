import type {
	ColumnDataType,
	FilterDetails,
	FilterOperatorTarget,
	FilterOperators,
	FilterTypeOperatorDetails,
	FilterValues,
} from "./types.js";

export const DEFAULT_OPERATORS: Record<
	ColumnDataType,
	Record<Exclude<FilterOperatorTarget, "any">, FilterOperators[ColumnDataType]>
> = {
	text: {
		single: "contains",
		multiple: "contains",
	},
	number: {
		single: "is",
		multiple: "is between",
	},
	bigint: {
		single: "is",
		multiple: "is between",
	},
	date: {
		single: "is",
		multiple: "is between",
	},
	boolean: {
		single: "is",
		multiple: "is",
	},
	option: {
		single: "is",
		multiple: "is any of",
	},
	multiOption: {
		single: "include",
		multiple: "include any of",
	},
};

export const optionFilterOperators = {
	is: {
		key: "filters.option.is",
		value: "is",
		target: "single",
		singularOf: "is any of",
		relativeOf: "is not",
		isNegated: false,
		negation: "is not",
	},
	"is not": {
		key: "filters.option.isNot",
		value: "is not",
		target: "single",
		singularOf: "is none of",
		relativeOf: "is",
		isNegated: true,
		negationOf: "is",
	},
	"is any of": {
		key: "filters.option.isAnyOf",
		value: "is any of",
		target: "multiple",
		pluralOf: "is",
		relativeOf: "is none of",
		isNegated: false,
		negation: "is none of",
	},
	"is none of": {
		key: "filters.option.isNoneOf",
		value: "is none of",
		target: "multiple",
		pluralOf: "is not",
		relativeOf: "is any of",
		isNegated: true,
		negationOf: "is any of",
	},
} as const satisfies FilterDetails<"option">;

export const multiOptionFilterOperators = {
	include: {
		key: "filters.multiOption.include",
		value: "include",
		target: "single",
		singularOf: "include any of",
		relativeOf: "exclude",
		isNegated: false,
		negation: "exclude",
	},
	exclude: {
		key: "filters.multiOption.exclude",
		value: "exclude",
		target: "single",
		singularOf: "exclude if any of",
		relativeOf: "include",
		isNegated: true,
		negationOf: "include",
	},
	"include any of": {
		key: "filters.multiOption.includeAnyOf",
		value: "include any of",
		target: "multiple",
		pluralOf: "include",
		relativeOf: ["exclude if all", "include all of", "exclude if any of"],
		isNegated: false,
		negation: "exclude if all",
	},
	"exclude if all": {
		key: "filters.multiOption.excludeIfAll",
		value: "exclude if all",
		target: "multiple",
		pluralOf: "exclude",
		relativeOf: ["include any of", "include all of", "exclude if any of"],
		isNegated: true,
		negationOf: "include any of",
	},
	"include all of": {
		key: "filters.multiOption.includeAllOf",
		value: "include all of",
		target: "multiple",
		pluralOf: "include",
		relativeOf: ["include any of", "exclude if all", "include exactly", "exclude if any of"],
		isNegated: false,
		negation: "exclude if any of",
	},
	"include exactly": {
		key: "filters.multiOption.includeExactly",
		value: "include exactly",
		target: "any",
		relativeOf: ["include", "include any of", "include all of", "exclude exactly"],
		isNegated: false,
		negation: "exclude exactly",
	},
	"exclude if any of": {
		key: "filters.multiOption.excludeIfAnyOf",
		value: "exclude if any of",
		target: "multiple",
		pluralOf: "exclude",
		relativeOf: ["include any of", "exclude if all", "include all of", "exclude exactly"],
		isNegated: true,
		negationOf: "include all of",
	},
	"exclude exactly": {
		key: "filters.multiOption.excludeExactly",
		value: "exclude exactly",
		target: "any",
		relativeOf: ["exclude", "exclude if any of", "exclude if all", "include exactly"],
		isNegated: true,
		negationOf: "include exactly",
	},
} as const satisfies FilterDetails<"multiOption">;

export const dateFilterOperators = {
	is: {
		key: "filters.date.is",
		value: "is",
		target: "single",
		singularOf: "is between",
		relativeOf: "is after",
		isNegated: false,
		negation: "is before",
	},
	"is not": {
		key: "filters.date.isNot",
		value: "is not",
		target: "single",
		singularOf: "is not between",
		relativeOf: ["is", "is before", "is on or after", "is after", "is on or before"],
		isNegated: true,
		negationOf: "is",
	},
	"is before": {
		key: "filters.date.isBefore",
		value: "is before",
		target: "single",
		singularOf: "is between",
		relativeOf: ["is", "is not", "is on or after", "is after", "is on or before"],
		isNegated: false,
		negation: "is on or after",
	},
	"is on or after": {
		key: "filters.date.isOnOrAfter",
		value: "is on or after",
		target: "single",
		singularOf: "is between",
		relativeOf: ["is", "is not", "is before", "is after", "is on or before"],
		isNegated: false,
		negation: "is before",
	},
	"is after": {
		key: "filters.date.isAfter",
		value: "is after",
		target: "single",
		singularOf: "is between",
		relativeOf: ["is", "is not", "is before", "is on or after", "is on or before"],
		isNegated: false,
		negation: "is on or before",
	},
	"is on or before": {
		key: "filters.date.isOnOrBefore",
		value: "is on or before",
		target: "single",
		singularOf: "is between",
		relativeOf: ["is", "is not", "is after", "is on or after", "is before"],
		isNegated: false,
		negation: "is after",
	},
	"is between": {
		key: "filters.date.isBetween",
		value: "is between",
		target: "multiple",
		pluralOf: "is",
		relativeOf: "is not between",
		isNegated: false,
		negation: "is not between",
	},
	"is not between": {
		key: "filters.date.isNotBetween",
		value: "is not between",
		target: "multiple",
		pluralOf: "is not",
		relativeOf: "is between",
		isNegated: true,
		negationOf: "is between",
	},
} as const satisfies FilterDetails<"date">;

export const textFilterOperators = {
	contains: {
		key: "filters.text.contains",
		value: "contains",
		target: "single",
		relativeOf: "does not contain",
		isNegated: false,
		negation: "does not contain",
	},
	"does not contain": {
		key: "filters.text.doesNotContain",
		value: "does not contain",
		target: "single",
		relativeOf: "contains",
		isNegated: true,
		negationOf: "contains",
	},
} as const satisfies FilterDetails<"text">;

export const numberFilterOperators = {
	is: {
		key: "filters.number.is",
		value: "is",
		target: "single",
		singularOf: "is between",
		relativeOf: [
			"is not",
			"is greater than",
			"is less than or equal to",
			"is less than",
			"is greater than or equal to",
		],
		isNegated: false,
		negation: "is not",
	},
	"is not": {
		key: "filters.number.isNot",
		value: "is not",
		target: "single",
		singularOf: "is not between",
		relativeOf: [
			"is",
			"is greater than",
			"is less than or equal to",
			"is less than",
			"is greater than or equal to",
		],
		isNegated: true,
		negationOf: "is",
	},
	"is greater than": {
		key: "filters.number.greaterThan",
		value: "is greater than",
		target: "single",
		singularOf: "is between",
		relativeOf: [
			"is",
			"is not",
			"is less than or equal to",
			"is less than",
			"is greater than or equal to",
		],
		isNegated: false,
		negation: "is less than or equal to",
	},
	"is greater than or equal to": {
		key: "filters.number.greaterThanOrEqual",
		value: "is greater than or equal to",
		target: "single",
		singularOf: "is between",
		relativeOf: ["is", "is not", "is greater than", "is less than or equal to", "is less than"],
		isNegated: false,
		negation: "is less than or equal to",
	},
	"is less than": {
		key: "filters.number.lessThan",
		value: "is less than",
		target: "single",
		singularOf: "is between",
		relativeOf: [
			"is",
			"is not",
			"is greater than",
			"is less than or equal to",
			"is greater than or equal to",
		],
		isNegated: false,
		negation: "is greater than",
	},
	"is less than or equal to": {
		key: "filters.number.lessThanOrEqual",
		value: "is less than or equal to",
		target: "single",
		singularOf: "is between",
		relativeOf: [
			"is",
			"is not",
			"is greater than",
			"is less than",
			"is greater than or equal to",
		],
		isNegated: false,
		negation: "is greater than or equal to",
	},
	"is between": {
		key: "filters.number.isBetween",
		value: "is between",
		target: "multiple",
		pluralOf: "is",
		relativeOf: "is not between",
		isNegated: false,
		negation: "is not between",
	},
	"is not between": {
		key: "filters.number.isNotBetween",
		value: "is not between",
		target: "multiple",
		pluralOf: "is not",
		relativeOf: "is between",
		isNegated: true,
		negationOf: "is between",
	},
} as const satisfies FilterDetails<"number">;

export const bigIntFilterOperators = numberFilterOperators satisfies FilterDetails<"bigint">;

export const booleanFilterOperators = {
	is: {
		key: "filters.boolean.is",
		value: "is",
		target: "single",
		singularOf: "is not",
		relativeOf: "is not",
		isNegated: false,
		negation: "is not",
	},
	"is not": {
		key: "filters.boolean.isNot",
		value: "is not",
		target: "single",
		singularOf: "is",
		relativeOf: "is",
		isNegated: true,
		negationOf: "is",
	},
} as const satisfies FilterDetails<"boolean">;

export const filterTypeOperatorDetails: FilterTypeOperatorDetails = {
	text: textFilterOperators,
	number: numberFilterOperators,
	bigint: bigIntFilterOperators,
	date: dateFilterOperators,
	boolean: booleanFilterOperators,
	option: optionFilterOperators,
	multiOption: multiOptionFilterOperators,
};

export function determineNewOperator<TType extends ColumnDataType>(
	type: TType,
	oldVals: FilterValues<TType>,
	nextVals: FilterValues<TType>,
	currentOperator: FilterOperators[TType]
): FilterOperators[TType] {
	const a =
		Array.isArray(oldVals) && Array.isArray(oldVals[0]) ? oldVals[0].length : oldVals.length;
	const b =
		Array.isArray(nextVals) && Array.isArray(nextVals[0])
			? nextVals[0].length
			: nextVals.length;

	if (a === b || (a >= 2 && b >= 2) || (a <= 1 && b <= 1)) return currentOperator;

	const opDetails = filterTypeOperatorDetails[type][currentOperator];
	if (a < b && b >= 2) return opDetails.singularOf ?? currentOperator;
	if (a > b && b <= 1) return opDetails.pluralOf ?? currentOperator;
	return currentOperator;
}
